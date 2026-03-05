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

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 60;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const background = new Image();
background.src = "signal-2026-03-04-162705.png";

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

/* Mosquito */
class Mosquito {
    constructor(type="normal") {
        this.type = type;
        this.size = 40;
        this.x = Math.random() * (canvas.width - this.size);
        this.y = Math.random() * (canvas.height - this.size);
        this.dx = (Math.random() - 0.5) * 4;
        this.dy = (Math.random() - 0.5) * 4;
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
        ctx.fillStyle = this.type === "special" ? "red" : "black";
        ctx.beginPath();
        ctx.arc(this.x + 20, this.y + 20, 15, 0, Math.PI * 2);
        ctx.fill();
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
    if (wave < 4) return;
    misses++;
    if (misses % 2 === 0) {
        hearts--;
        updateUI();
        if (hearts <= 0) gameOver();
    }
}

function gameOver() {
    alert("Game Over\nScore: " + score);
    location.reload();
}

function spawn() {
    if (!gameRunning) return;

    wave = score >= 50 ? 4 :
           score >= 25 ? 3 :
           score >= 10 ? 2 : 1;

    let type = (wave >= 4 && Math.random() < 0.2)
        ? "special"
        : "normal";

    mosquitoes.push(new Mosquito(type));

    setTimeout(spawn, Math.max(500, 1000 - wave * 100));
}

canvas.addEventListener("click", e => {
    if (!gameRunning || gamePaused) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let hit = false;

    mosquitoes = mosquitoes.filter(m => {
        const d = Math.hypot(x - (m.x + 20), y - (m.y + 20));
        if (d < 20) {
            hit = true;
            score += m.type === "special" ? 10 : 1;
            return false;
        }
        return true;
    });

    if (!hit) registerMiss();
    updateUI();
});

function loop() {
    if (!gameRunning) return;

    if (!gamePaused) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        mosquitoes.forEach(m => m.update());
        mosquitoes.forEach(m => m.draw());

        mosquitoes = mosquitoes.filter(m => {
            if (m.expired()) {
                registerMiss();
                return false;
            }
            return true;
        });
    }

    requestAnimationFrame(loop);
}

/* UI Controls */
playBtn.onclick = () => {
    welcomeScreen.style.display = "none";
    topBar.style.display = "flex";
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