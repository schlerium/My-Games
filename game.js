const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const rotateScreen = document.getElementById("rotateScreen");
const topBar = document.getElementById("topBar");

function checkOrientation() {
    if (window.innerHeight > window.innerWidth) {
        rotateScreen.style.display = "flex";
    } else {
        rotateScreen.style.display = "none";
    }
}
window.addEventListener("resize", checkOrientation);
checkOrientation();

/* Fixed internal design resolution. The canvas buffer is ALWAYS this size,
   regardless of device - CSS (aspect-ratio + height:100%) scales it visually
   to fit the screen without stretching. This keeps mosquito size/speed and
   background composition identical across every device. Click coordinates
   are converted from rendered size to this fixed buffer in the click handler. */
const DESIGN_WIDTH = 1080;
const DESIGN_HEIGHT = 1920;

function resizeCanvas() {
    canvas.width = DESIGN_WIDTH;
    canvas.height = DESIGN_HEIGHT;
}
resizeCanvas();

/* Assets */
const background = new Image();
background.src = "gameplay_bg.png";
let backgroundReady = false;
background.onload = () => { backgroundReady = true; };

const mosquitoImg = new Image();
mosquitoImg.src = "mosquito.png";
const mosquitoSpecialImg = new Image();
mosquitoSpecialImg.src = "mosquito_special.png";
let spritesReady = { normal: false, special: false };
mosquitoImg.onload = () => { spritesReady.normal = true; };
mosquitoSpecialImg.onload = () => { spritesReady.special = true; };

/* UI */
const welcomeScreen = document.getElementById("welcomeScreen");
const creditsScreen = document.getElementById("creditsScreen");
const pauseMenu = document.getElementById("pauseMenu");

const playBtn = document.getElementById("playBtn");
const creditsBtn = document.getElementById("creditsBtn");
const backBtn = document.getElementById("backBtn");

const pauseBtn = document.getElementById("pauseBtn");
const exitBtn = document.getElementById("exitBtn");

const resumeBtn = document.getElementById("resumeBtn");
const pauseExitBtn = document.getElementById("pauseExitBtn");

const scoreDisplay = document.getElementById("scoreDisplay");
const heartDisplay = document.getElementById("heartDisplay");

/* Game State */
let score = 0;
let hearts = 10;
let misses = 0;
let wave = 1;
let mosquitoes = [];
let gameRunning = false;
let gamePaused = false;
let spawnTimer = null;

/* Wave popup state */
let waveBanner = { text: "", alpha: 0, startedAt: 0 };
const WAVE_BANNER_DURATION = 1400; // ms, fade included

/* ---- Difficulty curve ----
   Wave rises steadily with score (every 15 points), uncapped.
   Spawn interval eases toward a floor using exponential decay so it
   never goes to zero/infinite speed - just gets asymptotically harder.
   Miss tolerance also tightens gradually instead of switching on suddenly. */
function waveForScore(s) {
    return Math.floor(s / 15) + 1;
}

function spawnIntervalForWave(w) {
    const base = 1000;
    const floor = 350;
    const interval = base * Math.pow(0.92, w - 1);
    return Math.max(floor, interval);
}

function speedMultiplierForWave(w) {
    // Gentle, capped growth - approaches 2.2x speed, never runs away
    return 1 + Math.min(1.2, (w - 1) * 0.12);
}

function missToleranceForWave(w) {
    // Higher number = more forgiving. Eases down from 4 -> 2 as waves climb.
    return Math.max(2, 4 - Math.floor((w - 1) / 3));
}

function maybeAnnounceWave(newWave) {
    if (newWave !== wave) {
        wave = newWave;
        waveBanner = { text: "WAVE " + wave, alpha: 1, startedAt: Date.now() };
    }
}

/* Mosquito */
// Size/speed are scaled relative to the fixed design resolution (1080x1920)
// so they read consistently at any display size rather than being tuned to
// whatever pixel buffer a device happened to produce.
const MOSQUITO_SIZE = Math.round(DESIGN_WIDTH * 0.09);   // ~97px on a 1080-wide buffer
const BASE_SPEED = DESIGN_WIDTH * 0.008;                  // ~8.6px/frame baseline

class Mosquito {
    constructor(type = "normal") {
        this.type = type;
        this.size = MOSQUITO_SIZE;
        this.x = Math.random() * (canvas.width - this.size);
        this.y = Math.random() * (canvas.height - this.size);
        const speed = speedMultiplierForWave(wave);
        this.dx = (Math.random() - 0.5) * 2 * BASE_SPEED * speed;
        this.dy = (Math.random() - 0.5) * 2 * BASE_SPEED * speed;
        this.spawn = Date.now();
        this.life = 2500;
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;

        if (this.x < 0 || this.x + this.size > canvas.width) this.dx *= -1;
        if (this.y < 0 || this.y + this.size > canvas.height) this.dy *= -1;
    }

    draw() {
        const img = this.type === "special" ? mosquitoSpecialImg : mosquitoImg;
        const ready = this.type === "special" ? spritesReady.special : spritesReady.normal;

        if (ready) {
            ctx.drawImage(img, this.x, this.y, this.size, this.size);
        } else {
            // Fallback while sprite loads, so nothing invisible/broken shows
            ctx.fillStyle = this.type === "special" ? "red" : "black";
            ctx.beginPath();
            ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size * 0.375, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    expired() {
        return Date.now() - this.spawn > this.life;
    }
}

function updateUI() {
    scoreDisplay.textContent = "🦟 " + score;
    heartDisplay.textContent = "❤️ " + hearts;
}

function registerMiss() {
    misses++;
    const tolerance = missToleranceForWave(wave);
    if (misses % tolerance === 0) {
        hearts--;
        updateUI();
        if (hearts <= 0) gameOver();
    }
}

function gameOver() {
    clearTimeout(spawnTimer);
    alert("Game Over\nScore: " + score);
    location.reload();
}

function spawn() {
    if (!gameRunning) return;

    maybeAnnounceWave(waveForScore(score));

    let type = (wave >= 4 && Math.random() < 0.2) ? "special" : "normal";
    mosquitoes.push(new Mosquito(type));

    spawnTimer = setTimeout(spawn, spawnIntervalForWave(wave));
}

canvas.addEventListener("click", e => {
    if (!gameRunning || gamePaused) return;

    const rect = canvas.getBoundingClientRect();
    // Scale click position from CSS pixels to canvas buffer pixels,
    // in case the canvas is ever displayed at a different size than its buffer.
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    let hit = false;

    mosquitoes = mosquitoes.filter(m => {
        const d = Math.hypot(x - (m.x + m.size / 2), y - (m.y + m.size / 2));
        if (d < m.size / 2) {
            hit = true;
            score += m.type === "special" ? 10 : 1;
            return false;
        }
        return true;
    });

    if (!hit) registerMiss();
    updateUI();
});

function drawWaveBanner() {
    if (waveBanner.alpha <= 0) return;

    const elapsed = Date.now() - waveBanner.startedAt;
    const fadeStart = 600; // ms before it starts fading
    if (elapsed > fadeStart) {
        waveBanner.alpha = Math.max(0, 1 - (elapsed - fadeStart) / (WAVE_BANNER_DURATION - fadeStart));
    }
    if (elapsed > WAVE_BANNER_DURATION) {
        waveBanner.alpha = 0;
        return;
    }

    ctx.save();
    ctx.globalAlpha = waveBanner.alpha;
    ctx.fillStyle = "yellow";
    ctx.font = "bold 84px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(waveBanner.text, canvas.width / 2, canvas.height / 2);
    ctx.restore();
}

function loop() {
    if (!gameRunning) return;

    if (!gamePaused) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (backgroundReady) {
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = "#111";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        mosquitoes.forEach(m => m.update());
        mosquitoes.forEach(m => m.draw());

        mosquitoes = mosquitoes.filter(m => {
            if (m.expired()) {
                registerMiss();
                return false;
            }
            return true;
        });

        drawWaveBanner();
    }

    requestAnimationFrame(loop);
}

/* UI Controls */
playBtn.onclick = () => {
    welcomeScreen.style.display = "none";
    topBar.style.display = "flex";
    resizeCanvas();

    score = 0;
    hearts = 10;
    misses = 0;
    wave = 1;
    mosquitoes = [];
    updateUI();

    waveBanner = { text: "WAVE 1", alpha: 1, startedAt: Date.now() };

    gameRunning = true;
    spawn();
    loop();
};

creditsBtn.onclick = () => {
    welcomeScreen.style.display = "none";
    creditsScreen.style.display = "flex";
};

backBtn.onclick = () => {
    creditsScreen.style.display = "none";
    welcomeScreen.style.display = "flex";
};

pauseBtn.onclick = () => {
    gamePaused = true;
    pauseMenu.style.display = "flex";
};

resumeBtn.onclick = () => {
    gamePaused = false;
    pauseMenu.style.display = "none";
};

pauseExitBtn.onclick = () => location.reload();
exitBtn.onclick = () => location.reload();
