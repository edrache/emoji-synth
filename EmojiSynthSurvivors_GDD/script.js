const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const VERSION = '0.5.0';

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const overlay = document.getElementById('overlay');
const overlayStart = document.getElementById('overlayStart');
const overlayMute = document.getElementById('overlayMute');
const levelupOverlay = document.getElementById('levelup');
const upgradeChoices = document.getElementById('upgradeChoices');

const hpValue = document.getElementById('hpValue');
const levelValue = document.getElementById('levelValue');
const bpmValue = document.getElementById('bpmValue');
const enemyValue = document.getElementById('enemyValue');
const xpValue = document.getElementById('xpValue');
const xpNextValue = document.getElementById('xpNextValue');
const killValue = document.getElementById('killValue');
const trackValue = document.getElementById('trackValue');
const audioStatus = document.getElementById('audioStatus');
const versionValue = document.getElementById('versionValue');
const logList = document.getElementById('logList');

const intensityBar = document.getElementById('intensityBar');
const filterBar = document.getElementById('filterBar');
const driveBar = document.getElementById('driveBar');

let running = false;
let paused = false;
let lastTime = 0;
let pulse = 0;
let killFlash = 0;

const keys = new Set();

const player = {
    x: 0,
    y: 0,
    radius: 18,
    speed: 220,
    hp: 100,
    maxHp: 100
};

const state = {
    level: 1,
    xp: 0,
    xpNext: 12,
    kills: 0,
    time: 0,
    fireRate: 0.35,
    bulletSpeed: 520,
    bulletDamage: 1,
    bpm: 120,
    track: ['Drums'],
    intensity: 0,
    lastBar: -1,
    spawnMultiplier: 1
};

const enemies = [];
const bullets = [];
const gems = [];
const particles = [];

const upgrades = [
    { id: 'fireRate', label: 'Rapid Sequencer (+20% fire rate)', apply: () => state.fireRate *= 0.8, available: () => true },
    { id: 'damage', label: 'Overdrive (+1 bullet damage)', apply: () => state.bulletDamage += 1, available: () => true },
    { id: 'speed', label: 'Velocity Mode (+15% speed)', apply: () => player.speed *= 1.15, available: () => true },
    { id: 'hp', label: 'Shield Stack (+25 max HP)', apply: () => { player.maxHp += 25; player.hp += 25; }, available: () => true }
];

const audio = {
    ready: false,
    muted: false,
    userGesture: false,
    transportReady: false,
    schedulerId: null,
    startTime: 0,
    step: 0,
    nextTick: 0,
    master: null,
    limiter: null,
    compressor: null,
    sidechain: null,
    filter: null,
    drive: null,
    reverb: null,
    kick: null,
    clap: null,
    hat: null,
    bass: null,
    lead: null,
    pad: null,
    chord: null,
    chime: null,
    hatLoop: null,
    bassLoop: null,
    padLoop: null,
    scheduled: [],
    scale: null,
    progression: null,
    progressionIndex: 0,
    chordTick: 0,
    bassActive: false,
    leadActive: false,
    padActive: false,
    sectionLabel: 'Intro',
    sectionId: 'Intro'
};

const ARRANGEMENT = [
    { bar: 0, bass: false, lead: false, pad: false, label: 'Intro', spawn: 0.7 },
    { bar: 8, bass: true, lead: false, pad: false, label: 'Build', spawn: 0.9 },
    { bar: 16, bass: true, lead: true, pad: false, label: 'Rise', spawn: 1.05 },
    { bar: 24, bass: false, lead: false, pad: false, label: 'Break', spawn: 0.4 },
    { bar: 28, bass: true, lead: true, pad: true, label: 'Drop', spawn: 1.35 },
    { bar: 44, bass: true, lead: true, pad: false, label: 'Drive', spawn: 1.1 },
    { bar: 56, bass: false, lead: false, pad: true, label: 'Outro', spawn: 0.6 }
];

const MUSIC = {
    style: 'Deep House',
    scales: [
        { name: 'A Minor', notes: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
        { name: 'D Dorian', notes: ['D', 'E', 'F', 'G', 'A', 'B', 'C'] },
        { name: 'E Phrygian', notes: ['E', 'F', 'G', 'A', 'B', 'C', 'D'] }
    ],
    progressions: [
        { name: 'i - VI - III - VII', degrees: [1, 6, 3, 7] },
        { name: 'i - v - VI - v', degrees: [1, 5, 6, 5] },
        { name: 'i - VII - VI - VII', degrees: [1, 7, 6, 7] }
    ]
};

const LIMITS = {
    enemies: 160,
    bullets: 220,
    gems: 120,
    particles: 700,
    scheduled: 600
};

function logEvent(message, type = 'info') {
    if (!logList) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.textContent = `[${time}] ${message}`;
    logList.prepend(entry);
    const maxEntries = 8;
    while (logList.children.length > maxEntries) {
        logList.removeChild(logList.lastChild);
    }
}

function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    player.x = rect.width * 0.5;
    player.y = rect.height * 0.6;
}

function resetGame() {
    state.level = 1;
    state.xp = 0;
    state.xpNext = 12;
    state.kills = 0;
    state.time = 0;
    state.fireRate = 0.35;
    state.bulletSpeed = 520;
    state.bulletDamage = 1;
    state.bpm = 120;
    state.track = ['Drums'];
    state.intensity = 0;
    state.lastBar = -1;

    player.hp = 100;
    player.maxHp = 100;
    player.speed = 220;

    enemies.length = 0;
    bullets.length = 0;
    gems.length = 0;
    particles.length = 0;

    audio.bassActive = false;
    audio.leadActive = false;
    audio.padActive = false;
    audio.transportReady = false;
    stopScheduler();
    audio.sectionLabel = 'Intro';
    audio.progressionIndex = 0;
    audio.chordTick = 0;
    selectMusicSeed();
    updateTrack();
    resetOverlay();

    if (audio.ready && window.Tone) {
        audio.transportReady = false;
        stopScheduler();
    }
}

function selectMusicSeed() {
    const scale = MUSIC.scales[Math.floor(Math.random() * MUSIC.scales.length)];
    const progression = MUSIC.progressions[Math.floor(Math.random() * MUSIC.progressions.length)];
    audio.scale = scale;
    audio.progression = progression;
}

function activateLayer(layer) {
    if (!state.track.includes(layer)) {
        state.track.push(layer);
        if (layer === 'Bass') audio.bassActive = true;
        if (layer === 'Lead') audio.leadActive = true;
        if (layer === 'Pad') audio.padActive = true;
        updateTrack();
    }
}

function setLayerState({ bass, lead, pad }) {
    if (bass !== undefined) {
        audio.bassActive = bass;
        if (bass) activateLayer('Bass');
    }
    if (lead !== undefined) {
        audio.leadActive = lead;
        if (lead) activateLayer('Lead');
    }
    if (pad !== undefined) {
        audio.padActive = pad;
        if (pad) activateLayer('Pad');
    }
}

function updateTrack() {
    const scaleLabel = audio.scale ? `${audio.scale.name}` : 'Scale';
    const progLabel = audio.progression ? audio.progression.name : 'Progression';
    trackValue.textContent = `${state.track.join(' + ')} | ${scaleLabel} | ${progLabel} | ${audio.sectionLabel} | ${MUSIC.style}`;
}

function startGame() {
    resetGame();
    if (!running) {
        running = true;
        lastTime = performance.now();
        requestAnimationFrame(loop);
    }
    paused = false;
    pauseBtn.textContent = 'Pause';
    overlay.classList.remove('visible');
    pauseBtn.disabled = false;
}

function pauseGame() {
    if (!running) return;
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    overlay.classList.toggle('visible', paused);
    if (audio.ready && window.Tone) {
        if (paused) {
            stopScheduler();
        } else {
            startScheduler();
        }
    }
}

function loop(timestamp) {
    if (!running) return;
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    if (!paused) {
        try {
            update(dt);
            draw();
        } catch (err) {
            handleRuntimeError(err);
            return;
        }
    }

    requestAnimationFrame(loop);
}

function update(dt) {
    state.time += dt;
    spawnEnemies(dt);
    updatePlayer(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updateGems(dt);
    updateParticles(dt);
    updateAudio(dt);
    updateHud();
}

function updatePlayer(dt) {
    let dx = 0;
    let dy = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;

    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;

    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;

    const bounds = canvas.getBoundingClientRect();
    player.x = Math.max(30, Math.min(bounds.width - 30, player.x));
    player.y = Math.max(30, Math.min(bounds.height - 30, player.y));

    const filterValue = Math.min(1, Math.max(0, player.x / bounds.width));
    const driveValue = Math.min(1, Math.max(0, 1 - player.y / bounds.height));
    filterBar.style.width = `${Math.round(filterValue * 100)}%`;
    driveBar.style.width = `${Math.round(driveValue * 100)}%`;

    if (audio.ready && window.Tone) {
        const freq = 300 + filterValue * 2800;
        audio.filter.frequency.rampTo(freq, 0.05);
        audio.drive.distortion = 0.1 + driveValue * 0.6;
    }
}

function spawnEnemies(dt) {
    const phase = Math.sin(state.time * 0.22);
    const baseIntensity = (phase + 1) * 0.5;
    const densityTarget = Math.min(1, enemies.length / 40);
    const intensityTarget = Math.max(0.15, Math.min(1, baseIntensity * 0.6 + densityTarget * 0.6));
    state.intensity = state.intensity * 0.93 + intensityTarget * 0.07;
    intensityBar.style.width = `${Math.round(state.intensity * 100)}%`;

    const spawnRate = (0.35 + state.level * 0.04 + state.time * 0.001 + baseIntensity * 0.6) * state.spawnMultiplier;
    if (enemies.length >= LIMITS.enemies) return;
    if (Math.random() < spawnRate * dt) {
        const bounds = canvas.getBoundingClientRect();
        const edge = Math.floor(Math.random() * 4);
        let x = 0;
        let y = 0;
        if (edge === 0) { x = Math.random() * bounds.width; y = -40; }
        if (edge === 1) { x = bounds.width + 40; y = Math.random() * bounds.height; }
        if (edge === 2) { x = Math.random() * bounds.width; y = bounds.height + 40; }
        if (edge === 3) { x = -40; y = Math.random() * bounds.height; }

        const elite = Math.random() < 0.12 + state.level * 0.01;
        enemies.push({
            x,
            y,
            radius: elite ? 26 : 20,
            hp: elite ? 6 + state.level * 0.7 : 3 + state.level * 0.3,
            speed: elite ? 70 : 95,
            emoji: elite ? '👹' : '👾'
        });
    }
}

let fireTimer = 0;
function updateBullets(dt) {
    fireTimer -= dt;
    if (fireTimer <= 0 && enemies.length > 0) {
        fireTimer = state.fireRate;
        const target = enemies.reduce((closest, enemy) => {
            const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (!closest || dist < closest.dist) return { enemy, dist };
            return closest;
        }, null);

        if (target) {
            const angle = Math.atan2(target.enemy.y - player.y, target.enemy.x - player.x);
            bullets.push({
                x: player.x,
                y: player.y,
                vx: Math.cos(angle) * state.bulletSpeed,
                vy: Math.sin(angle) * state.bulletSpeed,
                radius: 6
            });
            if (audio.ready && audio.leadActive) playLead(angle);
        }
    }

    if (bullets.length > LIMITS.bullets) {
        bullets.splice(0, bullets.length - LIMITS.bullets);
    }

    for (let i = bullets.length - 1; i >= 0; i -= 1) {
        const bullet = bullets[i];
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        if (bullet.x < -50 || bullet.x > canvas.clientWidth + 50 || bullet.y < -50 || bullet.y > canvas.clientHeight + 50) {
            bullets.splice(i, 1);
        }
    }
}

function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
        const enemy = enemies[i];
        if (enemy.pendingRemove) continue;
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        enemy.x += Math.cos(angle) * enemy.speed * dt;
        enemy.y += Math.sin(angle) * enemy.speed * dt;

        if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.radius + player.radius) {
            player.hp -= 18 * dt;
            killFlash = Math.min(1, killFlash + dt * 2);
            if (player.hp <= 0) {
                gameOver();
            }
        }
    }

    for (let i = enemies.length - 1; i >= 0; i -= 1) {
        const enemy = enemies[i];
        if (enemy.pendingRemove) continue;
        for (let j = bullets.length - 1; j >= 0; j -= 1) {
            const bullet = bullets[j];
            if (Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < enemy.radius + bullet.radius) {
                enemy.hp -= state.bulletDamage;
                bullets.splice(j, 1);
                spawnParticles(enemy.x, enemy.y, enemy.emoji);
                if (enemy.hp <= 0) {
                    handleEnemyDeath(enemy, i);
                }
                break;
            }
        }
    }
}

function updateGems(dt) {
    for (let i = gems.length - 1; i >= 0; i -= 1) {
        const gem = gems[i];
        if (gem.collected) continue;
        const dist = Math.hypot(gem.x - player.x, gem.y - player.y);
        if (dist < 140) {
            gem.x += (player.x - gem.x) * dt * 6;
            gem.y += (player.y - gem.y) * dt * 6;
        }
        if (dist < player.radius + gem.radius) {
            collectGem(gem, i);
        }
    }
    if (gems.length > LIMITS.gems) {
        gems.splice(0, gems.length - LIMITS.gems);
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
    if (particles.length > LIMITS.particles) {
        particles.splice(0, particles.length - LIMITS.particles);
    }
}

function gainXp(amount) {
    state.xp += amount;
    if (state.xp >= state.xpNext) {
        state.xp -= state.xpNext;
        state.level += 1;
        state.xpNext = Math.round(state.xpNext * 1.25 + 4);
        openUpgrade();
    }
}

function openUpgrade() {
    paused = true;
    pauseBtn.textContent = 'Resume';
    levelupOverlay.classList.add('visible');
    upgradeChoices.innerHTML = '';

    let pool = upgrades.filter(upgrade => upgrade.available());
    if (pool.length < 3) pool = upgrades;

    const options = [];
    while (options.length < 3) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (!options.includes(pick)) options.push(pick);
    }

    options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'choice';
        button.textContent = option.label;
        button.addEventListener('click', () => {
            option.apply();
            levelupOverlay.classList.remove('visible');
            paused = false;
        }, { once: true });
        upgradeChoices.appendChild(button);
    });
}

function triggerKill() {
    pulse = 1;
    if (audio.ready) {
        const time = getNextQuantTime();
        scheduleAt(() => triggerKick(time), time);
        if (audio.bassActive) {
            scheduleAt(() => triggerBass(time), time);
        }
    }
}

function updateAudio(dt) {
    const intensity = Math.min(1, enemies.length / 35);
    const targetBpm = 123 + intensity * 6;
    state.bpm = state.bpm * 0.9 + targetBpm * 0.1;
    bpmValue.textContent = Math.round(state.bpm);

    if (audio.ready && window.Tone) {
        if (Tone.context && Tone.context.state !== 'running') {
            audioStatus.textContent = 'Audio: Suspended';
            return;
        }
        audioStatus.textContent = audio.muted ? 'Audio: Muted' : 'Audio: On';
        if (!audio.userGesture || !audio.transportReady) {
            return;
        }
        const intensity = state.intensity;
        const targetGain = 0.42 - intensity * 0.12;
        audio.master.gain.rampTo(audio.muted ? 0 : targetGain, 0.1);
        audio.reverb.wet.rampTo(0.1 + intensity * 0.06, 0.2);
    }
    pulse = Math.max(0, pulse - dt * 1.5);
    killFlash = Math.max(0, killFlash - dt * 0.6);
}

function updateArrangementAtBar(bar) {
    if (bar === state.lastBar) return;
    state.lastBar = bar;

    const next = [...ARRANGEMENT].reverse().find(entry => bar >= entry.bar) || ARRANGEMENT[0];
    if (next.label === audio.sectionId) return;
    audio.sectionLabel = next.label;
    audio.sectionId = next.label;
    state.spawnMultiplier = next.spawn;
    setLayerState(next);
    updateTrack();
    logEvent(`Section: ${next.label}`, 'info');
    if (next.spawn < 0.6) {
        trimEnemies(0.35);
    }
}

function trimEnemies(keepRatio) {
    const target = Math.floor(enemies.length * keepRatio);
    if (enemies.length <= target) return;
    enemies.splice(target);
}

async function setupAudio() {
    if (!window.Tone) {
        audioStatus.textContent = 'Audio: Unavailable';
        return;
    }

    audio.userGesture = true;
    await Tone.start();
    await ensureAudioRunning();

    if (audio.ready) {
        audioStatus.textContent = audio.muted ? 'Audio: Muted' : 'Audio: On';
        await ensureAudioRunning();
        logEvent('Audio resumed', 'info');
        return;
    }

    audio.master = new Tone.Gain(0.42).toDestination();
    audio.limiter = new Tone.Limiter(-1);
    audio.compressor = new Tone.Compressor({ threshold: -28, ratio: 8, attack: 0.01, release: 0.2 });
    audio.filter = new Tone.Filter(1200, 'lowpass');
    audio.drive = new Tone.Distortion(0.12);
    audio.reverb = new Tone.Reverb({ decay: 1.8, wet: 0.12 });

    audio.filter.connect(audio.drive);
    audio.drive.connect(audio.compressor);
    audio.compressor.connect(audio.reverb);
    audio.reverb.connect(audio.limiter);
    audio.limiter.connect(audio.master);

    audio.kick = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.4 }
    }).connect(audio.filter);
    audio.kick.volume.value = -10;

    audio.clap = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
    }).connect(audio.filter);
    audio.clap.volume.value = -20;

    audio.hat = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0 }
    }).connect(audio.filter);
    audio.hat.volume.value = -22;

    audio.bass = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { Q: 2, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.6 }
    }).connect(audio.filter);
    audio.bass.volume.value = -16;

    audio.lead = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 2,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.18, sustain: 0.15, release: 0.3 }
    }).connect(audio.filter);
    audio.lead.volume.value = -20;

    audio.pad = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 2,
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.4, decay: 1.0, sustain: 0.35, release: 1.2 }
    }).connect(audio.filter);
    audio.pad.volume.value = -24;

    audio.chord = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 3,
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.12, sustain: 0.2, release: 0.2 }
    }).connect(audio.filter);
    audio.chord.volume.value = -22;

    audio.chime = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 2,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.4 }
    }).connect(audio.filter);
    audio.chime.volume.value = -24;

    if (audio.compressor.sidechain) {
        audio.sidechain = new Tone.Gain(0.8);
        audio.kick.connect(audio.sidechain);
        audio.sidechain.connect(audio.compressor.sidechain);
    }

    startScheduler();

    audio.ready = true;
    audioStatus.textContent = 'Audio: On';
    logEvent('Audio initialized', 'info');
}

function muteAudio() {
    if (!audio.ready) return;
    audio.muted = !audio.muted;
    audio.master.gain.rampTo(audio.muted ? 0 : 0.42, 0.05);
    audioStatus.textContent = audio.muted ? 'Audio: Muted' : 'Audio: On';
    overlayMute.textContent = audio.muted ? 'Unmute' : 'Mute';
    logEvent(audio.muted ? 'Audio muted' : 'Audio unmuted', 'info');
}

function triggerKick(time) {
    if (!audio.ready) return;
    audio.kick.triggerAttackRelease('C1', '8n', time);
}

function triggerBass(time) {
    if (!audio.ready) return;
    const chord = getCurrentChord();
    const note = pickScaleNote(chord, 2);
    audio.bass.triggerAttackRelease(note, '8n', time);
}

function playLead(angle) {
    if (!audio.ready) return;
    const time = getNextQuantTime();
    const chord = getCurrentChord();
    const note = pickScaleNote(chord, 4);
    const detune = Math.sin(angle) * 15;
    audio.lead.set({ detune });
    scheduleAt(() => audio.lead.triggerAttackRelease(note, '8n', time), time);
}

function getCurrentChord(octave = 4) {
    if (!audio.scale || !audio.progression) return ['C4', 'E4', 'G4'];
    const degree = audio.progression.degrees[audio.progressionIndex];
    return buildChord(audio.scale, degree, octave);
}

function advanceChord() {
    audio.progressionIndex = (audio.progressionIndex + 1) % audio.progression.degrees.length;
}

function buildChord(scale, degree, octave) {
    const degreeIndex = (degree - 1) % scale.notes.length;
    const root = scale.notes[degreeIndex];
    const third = scale.notes[(degreeIndex + 2) % scale.notes.length];
    const fifth = scale.notes[(degreeIndex + 4) % scale.notes.length];
    const seventh = scale.notes[(degreeIndex + 6) % scale.notes.length];
    return [`${root}${octave}`, `${third}${octave}`, `${fifth}${octave}`, `${seventh}${octave}`];
}

function pickScaleNote(chord, octave) {
    if (!audio.scale) return `C${octave}`;
    const pool = audio.scale.notes;
    const root = chord && chord.length ? chord[0].slice(0, -1) : pool[0];
    const choices = [root, pool[Math.floor(Math.random() * pool.length)]];
    const note = choices[Math.floor(Math.random() * choices.length)];
    return `${note}${octave}`;
}

function getNextQuantTime() {
    if (!audio.ready || !audio.userGesture || !audio.transportReady) {
        return Tone.now() + 0.05;
    }
    const now = Tone.now();
    const stepDur = getStepDuration();
    const steps = Math.ceil((now - audio.startTime) / stepDur);
    return audio.startTime + steps * stepDur + 0.002;
}

function isOffGrid(time, threshold = 0.02) {
    const delta = Math.max(0, time - Tone.now());
    return delta > threshold;
}

function scheduleAt(callback, time) {
    if (!audio.ready || !audio.userGesture || !audio.transportReady) return;
    if (Tone.context && Tone.context.state !== 'running') return;
    if (typeof time !== 'number' || Number.isNaN(time)) return;
    callback(time);
}

function handleEnemyDeath(enemy, index) {
    if (!audio.ready) {
        enemies.splice(index, 1);
        state.kills += 1;
        gems.push({ x: enemy.x, y: enemy.y, radius: 10, emoji: '💎' });
        triggerKill();
        return;
    }

    const time = getNextQuantTime();
    const offGrid = isOffGrid(time);
    enemy.pendingRemove = true;
    enemy.pendingTime = time;
    enemy.pendingType = 'death';
    if (offGrid) enemy.pendingGlow = true;

    scheduleAt(() => {
        const idx = enemies.indexOf(enemy);
        if (idx !== -1) {
            enemies.splice(idx, 1);
        }
        state.kills += 1;
        gems.push({ x: enemy.x, y: enemy.y, radius: 10, emoji: '💎' });
        triggerKill();
    }, time);

    // Fallback if audio transport is suspended or missed.
    const fallbackDelay = Math.max(0, (time - Tone.now()) * 1000) + 300;
    setTimeout(() => {
        const idx = enemies.indexOf(enemy);
        if (idx !== -1) {
            enemies.splice(idx, 1);
            state.kills += 1;
            gems.push({ x: enemy.x, y: enemy.y, radius: 10, emoji: '💎' });
            triggerKill();
        }
    }, fallbackDelay);
}

function collectGem(gem, index) {
    if (!audio.ready) {
        gems.splice(index, 1);
        gainXp(2);
        return;
    }

    const time = getNextQuantTime();
    const offGrid = isOffGrid(time);
    gem.collected = true;
    gem.pendingTime = time;
    if (offGrid) gem.pendingGlow = true;

    scheduleAt(() => {
        const idx = gems.indexOf(gem);
        if (idx !== -1) {
            gems.splice(idx, 1);
        }
        const chord = getCurrentChord();
        const note = pickScaleNote(chord, 5);
        audio.chime.triggerAttackRelease(note, '16n', time);
        gainXp(2);
    }, time);

    // Fallback if audio transport is suspended or missed.
    const fallbackDelay = Math.max(0, (time - Tone.now()) * 1000) + 300;
    setTimeout(() => {
        const idx = gems.indexOf(gem);
        if (idx !== -1) {
            gems.splice(idx, 1);
            gainXp(2);
        }
    }, fallbackDelay);
}

function spawnParticles(x, y, emoji) {
    if (particles.length > LIMITS.particles) return;
    for (let i = 0; i < 6; i += 1) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 120,
            vy: (Math.random() - 0.5) * 120,
            emoji,
            life: 0.6 + Math.random() * 0.3
        });
    }
}

function draw() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.globalAlpha = 0.35 + pulse * 0.3;
    ctx.fillStyle = `rgba(255, 60, 172, ${0.2 + pulse * 0.2})`;
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(47, 224, 255, 0.8)';
    ctx.shadowBlur = 20 + pulse * 30;
    ctx.font = '28px "Space Grotesk"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👤', player.x, player.y);
    ctx.restore();

    enemies.forEach(enemy => {
        ctx.save();
        if (enemy.pendingGlow) {
            ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
        } else {
            ctx.shadowColor = enemy.emoji === '👹' ? 'rgba(255, 60, 172, 0.8)' : 'rgba(47, 224, 255, 0.7)';
        }
        ctx.shadowBlur = 18;
        ctx.font = `${enemy.emoji === '👹' ? 34 : 28}px "Space Grotesk"`;
        ctx.fillText(enemy.emoji, enemy.x, enemy.y);
        if (enemy.pendingGlow) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    });

    bullets.forEach(bullet => {
        ctx.save();
        ctx.fillStyle = 'rgba(180, 255, 47, 0.9)';
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(180, 255, 47, 0.8)';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    gems.forEach(gem => {
        ctx.save();
        ctx.shadowColor = gem.pendingGlow ? 'rgba(180, 255, 47, 0.9)' : 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = 12;
        ctx.font = '20px "Space Grotesk"';
        ctx.fillText(gem.emoji, gem.x, gem.y);
        if (gem.pendingGlow) {
            ctx.strokeStyle = 'rgba(180, 255, 47, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(gem.x, gem.y, gem.radius + 6, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    });

    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.font = '18px "Space Grotesk"';
        ctx.fillText(p.emoji, p.x, p.y);
        ctx.restore();
    });

    if (killFlash > 0.01) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 60, 172, ${killFlash * 0.35})`;
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.restore();
    }
}

function updateHud() {
    hpValue.textContent = Math.max(0, Math.round(player.hp));
    levelValue.textContent = state.level;
    enemyValue.textContent = enemies.length;
    xpValue.textContent = state.xp;
    xpNextValue.textContent = state.xpNext;
    killValue.textContent = state.kills;
}

function gameOver() {
    paused = true;
    overlay.classList.add('visible');
    overlay.querySelector('.panel-title').textContent = 'Session Over';
    overlay.querySelector('.panel-list').innerHTML = `<li>Kills: ${state.kills}</li><li>Level: ${state.level}</li><li>Track: ${state.track.join(' + ')}</li>`;
}

function resetOverlay() {
    overlay.querySelector('.panel-title').textContent = 'How to Play';
    overlay.querySelector('.panel-list').innerHTML = `
        <li>Move with WASD or arrow keys.</li>
        <li>Auto-fire locks onto the closest enemy.</li>
        <li>Collect 💎 to level up and add instruments.</li>
        <li>Your movement shapes the filter and drive.</li>
    `;
}

function handleRuntimeError(err) {
    console.error('Runtime error:', err);
    paused = true;
    overlay.classList.add('visible');
    overlay.querySelector('.panel-title').textContent = 'Session Paused (Error)';
    overlay.querySelector('.panel-list').innerHTML = `
        <li>Wystąpił błąd w trakcie gry.</li>
        <li>Otwórz konsolę i prześlij log.</li>
        <li>Możesz kliknąć Start, aby zrestartować sesję.</li>
    `;
    logEvent(`Error: ${err?.message || err}`, 'error');
}

async function ensureAudioRunning() {
    if (!window.Tone) return;
    if (Tone.context && Tone.context.state !== 'running') {
        try {
            await Tone.context.resume();
        } catch (err) {
            logEvent(`Audio resume failed: ${err?.message || err}`, 'error');
            return;
        }
    }
    if (Tone.context && Tone.context.state === 'running' && !audio.schedulerId && !paused) {
        startScheduler();
    }
}

function getStepDuration() {
    return 60 / state.bpm / 4;
}

function startScheduler() {
    stopScheduler();
    audio.startTime = Tone.now() + 0.05;
    audio.step = 0;
    audio.nextTick = audio.startTime;
    audio.transportReady = true;
    audio.schedulerId = window.setInterval(() => {
        if (!audio.ready || audio.muted) return;
        if (Tone.context && Tone.context.state !== 'running') return;
        const now = Tone.now();
        const stepDur = getStepDuration();
        while (audio.nextTick < now + 0.12) {
            const step = audio.step % 16;
            const bar = Math.floor(audio.step / 16);
            const swing = (step % 2 === 1) ? stepDur * 0.12 : 0;
            const tickTime = audio.nextTick + swing;

            if (step === 0) {
                updateArrangementAtBar(bar);
            }

            // Kick: 4-on-the-floor
            if (step % 4 === 0) {
                audio.kick.triggerAttackRelease('C1', '8n', tickTime);
            }
            // Clap on 2 and 4
            if (step === 4 || step === 12) {
                audio.clap.triggerAttackRelease('16n', tickTime);
            }
            // Hats on off-beats
            if (step % 2 === 1) {
                audio.hat.triggerAttackRelease('16n', tickTime);
            }
            // Bass pulse
            if (audio.bassActive && step % 2 === 0) {
                const chord = getCurrentChord();
                const note = pickScaleNote(chord, 2);
                audio.bass.triggerAttackRelease(note, '8n', tickTime);
            }
            // Chord stabs
            if (audio.leadActive && (step === 2 || step === 6 || step === 10 || step === 14)) {
                const chord = getCurrentChord(3);
                audio.chord.triggerAttackRelease(chord, '8n', tickTime);
            }
            // Pads on bar start
            if (audio.padActive && step === 0) {
                const chord = getCurrentChord();
                audio.pad.triggerAttackRelease(chord, '1m', tickTime);
                advanceChord();
            }

            audio.step += 1;
            audio.nextTick += stepDur;
        }
    }, 25);
    logEvent('Scheduler started', 'info');
}

function stopScheduler() {
    if (audio.schedulerId) {
        clearInterval(audio.schedulerId);
        audio.schedulerId = null;
        audio.transportReady = false;
    }
}

startBtn.addEventListener('click', async () => {
    await setupAudio();
    startGame();
    logEvent('Session started', 'info');
});

overlayStart.addEventListener('click', async () => {
    await setupAudio();
    startGame();
    logEvent('Session started', 'info');
});

overlayMute.addEventListener('click', async () => {
    await setupAudio();
    muteAudio();
});

pauseBtn.addEventListener('click', pauseGame);

window.addEventListener('keydown', (event) => {
    keys.add(event.code);
    if (event.code === 'Space' && running) {
        pauseGame();
    }
});

window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
});

window.addEventListener('resize', () => {
    resize();
});

document.addEventListener('visibilitychange', () => {
    if (!audio.ready || !window.Tone) return;
    if (document.visibilityState === 'visible') {
        if (audio.userGesture && Tone.context && Tone.context.state === 'suspended') {
            Tone.context.resume();
        }
    }
});

['pointerdown', 'keydown'].forEach((eventName) => {
    window.addEventListener(eventName, async () => {
        if (!audio.ready || !window.Tone) return;
        audio.userGesture = true;
        await ensureAudioRunning();
    }, { passive: true });
});

resize();
updateHud();
versionValue.textContent = `v${VERSION}`;
