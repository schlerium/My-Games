const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let gameState = 'menu';
let score = 0;
let hearts = 10;
let wave = 1;
let mosquitoes = [];
let gameLoopId;
let missCounter = 0;

/* ============================= */
/* SERVICE WORKER REGISTRATION   */
/* ============================= */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log("Service Worker Registered"))
            .catch(err => console.log("SW registration failed:", err));
    });
}

/* ============================= */
/* ASSETS                        */
/* ============================= */

const assets = {
    bg: new Image(),
    mos: new Image(),
    splat: new Image()
};

assets.bg.src = 'signal-2026-03-03-193349.png';
assets.mos.src = 'signal-2026-03-03-194334.png';
assets.splat.src = 'signal-2026-03-03-194342.png';

const healthStages = [
    'signal-2026-03-03-194349.png',
    'signal-2026-03-03-194356.png',
    'signal-2026-03-03-194401.png',
    'signal-2026-03-03-194407.png',
    'signal-2026-03-03-194413.png',
    'signal-2026-03-03-194422.png',
    'signal-2026-03-03-194432.png',
    'signal-2026-03-03-194441.png',
    'signal-2026-03-03-194452.png',
    'signal-2026-03-03-194506.png'
];

/* ============================= */
/* MOSQUITO CLASS                */
/* ============================= */

class Mosquito {
    constructor() {
        this.size = 70;
        this.speed = 2;
        this.resetPosition();
        this.status = 'alive';
        this.timer = 0;
        this.splatX = 0;
        this.splatY = 0;
    }

    resetPosition() {
        this.x = Math.random() * (canvas.width - this.size);
        this.y = Math.random() * (canvas.height - this.size);
        this.vx = (Math.random() - 0.5) * this.speed;
        this.vy = (Math.random() - 0.5) * this.speed;
    }

    update() {
        if (this.status === 'alive') {
            this.x += this.vx;
            this.y += this.vy;

            if (this.x <= 0 || this.x >= canvas.width - this.size) this.vx *= -1;
            if (this.y <= 0 || this.y >= canvas.height - this.size) this.vy *= -1;

            if (wave >= 4 && Math.random() < 0.002 * wave) {
                this.resetPosition();
            }
        }
        else if (this.status === 'splatted') {
            if (Date.now() - this.timer > 500) {
                this.status = 'dead';
            }
        }
    }

    draw() {
        if (this.status === 'alive')
            ctx.drawImage(assets.mos, this.x, this.y, this.size, this.size);
        else if (this.status === 'splatted')
            ctx.drawImage(assets.splat, this.splatX, this.splatY, this.size, this.size);
    }

    checkHit(tx, ty) {
        if (this.status !== 'alive') return false;

        const hit =
            tx > this.x &&
            tx < this.x + this.size &&
            ty > this.y &&
            ty < this.y + this.size;

        if (hit) {
            score += 5;
            this.status = 'splatted';
            this.splatX = this.x;
            this.splatY = this.y;
            this.timer = Date.now();
            updateHUD();
            return true;
        }

        return false;
    }
}

/* ============================= */
/* GAME CORE                     */
/* ============================= */

function updateHUD() {
    document.getElementById('score-display').innerText = score;
    const heartImg = document.getElementById('heart-sprite');
    const index = Math.min(9, 10 - hearts);
    heartImg.src = healthStages[index];

    if (hearts <= 0) endGame();
}

function spawnWave() {
    mosquitoes = [];
    const count = 5 + (wave - 1) * 5;
    for (let i = 0; i < count; i++)
        mosquitoes.push(new Mosquito());
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(assets.bg, 0, 0, canvas.width, canvas.height);

    mosquitoes = mosquitoes.filter(m => {
        m.update();
        m.draw();
        return m.status !== 'dead';
    });

    if (mosquitoes.length === 0 && gameState === 'playing') {
        wave++;
        spawnWave();
    }

    if (gameState === 'playing')
        gameLoopId = requestAnimationFrame(gameLoop);
}

/* ============================= */
/* CONTROLS                      */
/* ============================= */

canvas.addEventListener('pointerdown', (e) => {
    if (gameState !== 'playing') return;

    const rect = canvas.getBoundingClientRect();
    const tx = e.clientX - rect.left;
    const ty = e.clientY - rect.top;

    let hitSomething = false;

    mosquitoes.forEach(m => {
        if (m.checkHit(tx, ty)) hitSomething = true;
    });

    if (!hitSomething && wave >= 4) {
        missCounter++;
        if (missCounter >= 2) {
            hearts--;
            missCounter = 0;
            updateHUD();
        }
    }
});

/* ============================= */
/* GAME STATE CONTROL            */
/* ============================= */

function startGame() {
    gameState = 'playing';
    score = 0;
    hearts = 10;
    wave = 1;
    missCounter = 0;

    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');

    updateHUD();
    spawnWave();
    gameLoop();
}

function endGame() {
    gameState = 'gameover';
    cancelAnimationFrame(gameLoopId);
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('final-score').innerText = score;
}

function pauseGame() {
    if (gameState !== 'playing') return;
    gameState = 'paused';
    cancelAnimationFrame(gameLoopId);
    document.getElementById('pause-screen').classList.remove('hidden');
}

function resumeGame() {
    gameState = 'playing';
    document.getElementById('pause-screen').classList.add('hidden');
    gameLoop();
}

function exitToMenu() {
    gameState = 'menu';
    cancelAnimationFrame(gameLoopId);

    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
}

/* ============================= */
/* BUTTON BINDINGS               */
/* ============================= */

document.getElementById('btn-play').onclick = startGame;
document.getElementById('btn-restart').onclick = startGame;
document.getElementById('btn-credits').onclick = () => alert("Developer - Satyajit");
document.getElementById('btn-pause').onclick = pauseGame;
document.getElementById('btn-resume').onclick = resumeGame;
document.getElementById('btn-exit').onclick = exitToMenu;
document.getElementById('btn-close').onclick = exitToMenu;

/* ============================= */
/* RESIZE                        */
/* ============================= */

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
