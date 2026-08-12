const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');

// Configurações do Jogo
const GROUND_Y = 320;
let baseSpeed = 6;
let currentSpeed = baseSpeed;
let distance = 0;
let isGameOver = false;

// Estado das Teclas
let jumpRequested = false;

// Configuração do Jogador (Quadrado)
const player = {
    x: 100,
    y: GROUND_Y - 40,
    size: 40,
    vy: 0,
    gravity: 0.8,
    jumpForce: -14,
    isGrounded: false,
    rotation: 0, // em radianos
    rotationSpeed: 0.15,

    reset() {
        this.y = GROUND_Y - this.size;
        this.vy = 0;
        this.isGrounded = true;
        this.rotation = 0;
    },

    update() {
        // Pulo
        if (jumpRequested && this.isGrounded) {
            this.vy = this.jumpForce;
            this.isGrounded = false;
            jumpRequested = false;
        }

        // Aplica Gravidade
        this.vy += this.gravity;
        this.y += this.vy;

        // Rotação contínua enquanto estiver no ar
        if (!this.isGrounded) {
            this.rotation += this.rotationSpeed;
        } else {
            // Alinha o quadrado ao chão (múltiplo de 90° / PI/2)
            this.rotation = Math.round(this.rotation / (Math.PI / 2)) * (Math.PI / 2);
        }

        // Colisão simples com o Chão Principal
        if (this.y + this.size >= GROUND_Y) {
            this.y = GROUND_Y - this.size;
            this.vy = 0;
            this.isGrounded = true;
        }
    },

    draw() {
        ctx.save();
        // Translada e rotaciona a partir do centro do jogador
        ctx.translate(this.x + this.size / 2, this.y + this.size / 2);
        ctx.rotate(this.rotation);

        // Estilo Neon
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 15;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);

        // Borda interna para detalhe visual
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.size / 2 + 4, -this.size / 2 + 4, this.size - 8, this.size - 8);

        ctx.restore();
    }
};

// Gerenciador de Obstáculos
let obstacles = [];
let spawnTimer = 0;

class Obstacle {
    constructor(type) {
        this.type = type; // 'spike' ou 'block'
        this.x = canvas.width + 50;
        this.width = 40;
        this.height = 40;
        this.y = GROUND_Y - this.height;
    }

    update() {
        this.x -= currentSpeed;
    }

    draw() {
        ctx.save();
        if (this.type === 'spike') {
            // Desenha um Triângulo (Espinho)
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 15;

            ctx.beginPath();
            ctx.moveTo(this.x, this.y + this.height);
            ctx.lineTo(this.x + this.width / 2, this.y);
            ctx.lineTo(this.x + this.width, this.y + this.height);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'block') {
            // Desenha um Bloco Retangular
            ctx.fillStyle = '#ffbe00';
            ctx.shadowColor = '#ffbe00';
            ctx.shadowBlur = 15;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x + 3, this.y + 3, this.width - 6, this.height - 6);
        }
        ctx.restore();
    }
}

// Sistema de Partículas para Morte
let particles = [];

function createExplosion(x, y) {
    for (let i = 0; i < 30; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.5) * 12,
            size: Math.random() * 6 + 2,
            color: '#00f0ff',
            alpha: 1
        });
    }
}

function updateParticles() {
    particles.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.03;
        if (p.alpha <= 0) particles.splice(index, 1);
    });
}

function drawParticles() {
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.restore();
    });
}

// Fundo Parallax / Linhas de Velocidade
let bgOffset = 0;
function drawBackground() {
    bgOffset = (bgOffset + currentSpeed * 0.5) % 40;

    // Linhas verticais do fundo dando sensação de velocidade
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = -bgOffset; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GROUND_Y);
        ctx.stroke();
    }

    // Desenha o Chão Principal com brilho
    ctx.fillStyle = '#181925';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

    ctx.strokeStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(canvas.width, GROUND_Y);
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset
}

// Lógica de Colisão
function checkCollisions() {
    for (let obs of obstacles) {
        if (obs.type === 'spike') {
            // Colisão AABB aproximada para Espinhos
            if (
                player.x < obs.x + obs.width - 8 &&
                player.x + player.size > obs.x + 8 &&
                player.y < obs.y + obs.height &&
                player.y + player.size > obs.y
            ) {
                triggerGameOver();
            }
        } else if (obs.type === 'block') {
            // Colisão com Blocos
            let pRight = player.x + player.size;
            let pBottom = player.y + player.size;
            let obsRight = obs.x + obs.width;
            let obsBottom = obs.y + obs.height;

            if (pRight > obs.x && player.x < obsRight && pBottom > obs.y && player.y < obsBottom) {
                // Checa se pousou em cima do bloco
                let prevPlayerBottom = pBottom - player.vy;
                if (prevPlayerBottom <= obs.y + 10 && player.vy >= 0) {
                    player.y = obs.y - player.size;
                    player.vy = 0;
                    player.isGrounded = true;
                } else {
                    // Bateu na lateral ou por baixo -> Game Over
                    triggerGameOver();
                }
            }
        }
    }
}

// Spawn de Obstáculos
function handleObstacles() {
    spawnTimer++;
    // Intervalo aleatório ajustado com a velocidade
    if (spawnTimer > Math.max(50, 100 - currentSpeed * 3)) {
        let type = Math.random() > 0.4 ? 'spike' : 'block';
        obstacles.push(new Obstacle(type));
        spawnTimer = 0;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].update();
        obstacles[i].draw();

        // Remove obstáculos que saíram da tela
        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
        }
    }
}

// Interface de Pontuação (UI)
function drawUI() {
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 5;
    ctx.fillText(`DISTÂNCIA: ${Math.floor(distance)}m`, 20, 35);
    ctx.shadowBlur = 0;
}

// Fim de Jogo
function triggerGameOver() {
    if (isGameOver) return;
    isGameOver = true;
    createExplosion(player.x + player.size / 2, player.y + player.size / 2);
    
    setTimeout(() => {
        finalScoreEl.innerText = Math.floor(distance);
        gameOverScreen.classList.remove('hidden');
    }, 400);
}

// Reiniciar Jogo
function restartGame() {
    obstacles = [];
    particles = [];
    distance = 0;
    currentSpeed = baseSpeed;
    spawnTimer = 0;
    player.reset();
    isGameOver = false;
    gameOverScreen.classList.add('hidden');
    requestAnimationFrame(gameLoop);
}

// Controles
function handleJump() {
    if (isGameOver) return;
    jumpRequested = true;
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (isGameOver) {
            restartGame();
        } else {
            handleJump();
        }
    }
});

canvas.addEventListener('mousedown', () => {
    if (!isGameOver) handleJump();
});

restartBtn.addEventListener('click', restartGame);

// Loop Principal
function gameLoop() {
    // Limpa a tela
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();

    if (!isGameOver) {
        // Aumenta velocidade gradualmente
        currentSpeed += 0.001;
        distance += currentSpeed * 0.05;

        player.update();
        handleObstacles();
        checkCollisions();
        player.draw();
    } else {
        // Continua desenhando obstáculos no estado estático
        obstacles.forEach(obs => obs.draw());
    }

    updateParticles();
    drawParticles();
    drawUI();

    if (!isGameOver || particles.length > 0) {
        requestAnimationFrame(gameLoop);
    }
}

// Inicia o jogo
player.reset();
requestAnimationFrame(gameLoop);
