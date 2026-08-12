const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- CONFIGURAÇÕES GERAIS ---
const TILE_SIZE = 32;
const WORLD_WIDTH = 200; // Largura do mundo em blocos
const WORLD_HEIGHT = 100; // Altura do mundo em blocos
const GRAVITY = 0.5;

// ID dos Blocos
const BLOCKS = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    WOOD: 4
};

const BLOCK_COLORS = {
    [BLOCKS.GRASS]: '#2ecc71',
    [BLOCKS.DIRT]: '#795548',
    [BLOCKS.STONE]: '#7f8c8d',
    [BLOCKS.WOOD]: '#a1887f'
};

// --- MUNDO E CÂMERA ---
let world = [];
const camera = { x: 0, y: 0 };

function generateWorld() {
    for (let x = 0; x < WORLD_WIDTH; x++) {
        world[x] = [];
        // Gerador simples de terreno ondulado
        let surfaceY = Math.floor(30 + Math.sin(x * 0.1) * 5);
        
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            if (y < surfaceY) {
                world[x][y] = BLOCKS.AIR;
            } else if (y === surfaceY) {
                world[x][y] = BLOCKS.GRASS;
            } else if (y < surfaceY + 10) {
                world[x][y] = BLOCKS.DIRT;
            } else {
                world[x][y] = BLOCKS.STONE;
            }
        }
    }
}

// --- JOGADOR ---
class Player {
    constructor() {
        this.x = (WORLD_WIDTH * TILE_SIZE) / 2;
        this.y = 0;
        this.width = 24;
        this.height = 48;
        this.vx = 0;
        this.vy = 0;
        this.speed = 4;
        this.jumpPower = 10;
        this.grounded = false;

        // Atributos & RPG
        this.level = 1;
        this.xp = 0;
        this.xpNext = 100;
        this.maxHp = 100;
        this.hp = 100;
        this.damage = 15;
        this.statPoints = 0;
        this.selectedBlock = BLOCKS.DIRT;
    }

    update() {
        // Controles de movimento
        if (keys['KeyA'] || keys['ArrowLeft']) this.vx = -this.speed;
        else if (keys['KeyD'] || keys['ArrowRight']) this.vx = this.speed;
        else this.vx = 0;

        if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && this.grounded) {
            this.vy = -this.jumpPower;
            this.grounded = false;
        }

        // Aplica gravidade
        this.vy += GRAVITY;

        // Movimento e Colisões
        this.x += this.vx;
        this.checkCollision(true); // Eixo X

        this.y += this.vy;
        this.grounded = false;
        this.checkCollision(false); // Eixo Y

        // Atualizar Câmera
        camera.x = this.x - canvas.width / 2;
        camera.y = this.y - canvas.height / 2;
    }

    checkCollision(isX) {
        let startX = Math.floor((this.x) / TILE_SIZE);
        let endX = Math.floor((this.x + this.width) / TILE_SIZE);
        let startY = Math.floor((this.y) / TILE_SIZE);
        let endY = Math.floor((this.y + this.height) / TILE_SIZE);

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                if (world[x] && world[x][y] !== BLOCKS.AIR) {
                    if (isX) {
                        if (this.vx > 0) this.x = x * TILE_SIZE - this.width;
                        if (this.vx < 0) this.x = (x + 1) * TILE_SIZE;
                    } else {
                        if (this.vy > 0) {
                            this.y = y * TILE_SIZE - this.height;
                            this.grounded = true;
                            this.vy = 0;
                        }
                        if (this.vy < 0) {
                            this.y = (y + 1) * TILE_SIZE;
                            this.vy = 0;
                        }
                    }
                }
            }
        }
    }

    addXP(amount) {
        this.xp += amount;
        if (this.xp >= this.xpNext) {
            this.level++;
            this.xp -= this.xpNext;
            this.xpNext = Math.floor(this.xpNext * 1.5);
            this.statPoints += 3;
            this.maxHp += 20;
            this.hp = this.maxHp;
        }
        updateHUD();
    }

    draw() {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
    }
}

// --- INIMIGOS ---
class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'slime' ou 'zombie'
        this.width = type === 'slime' ? 28 : 24;
        this.height = type === 'slime' ? 20 : 48;
        this.hp = type === 'slime' ? 30 : 60;
        this.maxHp = this.hp;
        this.damage = type === 'slime' ? 8 : 15;
        this.xpReward = type === 'slime' ? 25 : 60;
        this.vx = 1;
        this.vy = 0;
        this.color = type === 'slime' ? '#00FF00' : '#27ae60';
    }

    update() {
        // IA básica de perseguição
        if (player.x > this.x) this.vx = 1;
        else this.vx = -1;

        this.vy += GRAVITY;
        this.x += this.vx;
        this.y += this.vy;

        // Colisão simplificada com chão
        let tileX = Math.floor((this.x + this.width / 2) / TILE_SIZE);
        let tileY = Math.floor((this.y + this.height) / TILE_SIZE);

        if (world[tileX] && world[tileX][tileY] !== BLOCKS.AIR) {
            this.y = (tileY * TILE_SIZE) - this.height;
            this.vy = 0;
        }

        // Dano no Jogador
        if (this.checkPlayerCollision()) {
            player.hp -= this.damage * 0.05; // Dano contínuo
            if (player.hp <= 0) player.hp = 0;
            updateHUD();
        }
    }

    checkPlayerCollision() {
        return (
            this.x < player.x + player.width &&
            this.x + this.width > player.x &&
            this.y < player.y + player.height &&
            this.y + this.height > player.y
        );
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
    }
}

// --- SISTEMA DE ENTRADA & INTERAÇÃO ---
const keys = {};
const player = new Player();
let enemies = [];

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// Mineração e Construção com o Mouse
canvas.addEventListener('mousedown', (e) => {
    const worldX = Math.floor((e.clientX + camera.x) / TILE_SIZE);
    const worldY = Math.floor((e.clientY + camera.y) / TILE_SIZE);

    if (world[worldX] && world[worldX][worldY] !== undefined) {
        if (e.button === 0) { 
            // Botão Esquerdo: Quebrar Bloco ou Atacar Inimigo
            let hitEnemy = false;
            enemies.forEach((enemy, index) => {
                let enemyCanvasX = enemy.x - camera.x;
                let enemyCanvasY = enemy.y - camera.y;
                if (e.clientX >= enemyCanvasX && e.clientX <= enemyCanvasX + enemy.width &&
                    e.clientY >= enemyCanvasY && e.clientY <= enemyCanvasY + enemy.height) {
                    
                    enemy.hp -= player.damage;
                    hitEnemy = true;
                    if (enemy.hp <= 0) {
                        player.addXP(enemy.xpReward);
                        enemies.splice(index, 1);
                    }
                }
            });

            if (!hitEnemy) {
                world[worldX][worldY] = BLOCKS.AIR; // Quebra bloco
            }
        } else if (e.button === 2) { 
            // Botão Direito: Colocar Bloco
            if (world[worldX][worldY] === BLOCKS.AIR) {
                world[worldX][worldY] = player.selectedBlock;
            }
        }
    }
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

// --- MUDANÇA DE SLOT DO INVENTÁRIO ---
document.querySelectorAll('.slot').forEach(slot => {
    slot.addEventListener('click', () => {
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
        slot.classList.add('active');
        player.selectedBlock = parseInt(slot.getAttribute('data-block'));
    });
});

// --- SISTEMA DE UPGRADE ---
function upgradeStat(stat) {
    if (player.statPoints <= 0) return;

    if (stat === 'hp') {
        player.maxHp += 25;
        player.hp += 25;
    } else if (stat === 'damage') {
        player.damage += 5;
    } else if (stat === 'speed') {
        player.speed += 0.5;
    }

    player.statPoints--;
    updateHUD();
}

function updateHUD() {
    document.getElementById('hp-text').innerText = `${Math.ceil(player.hp)}/${player.maxHp}`;
    document.getElementById('hp-bar').style.width = `${(player.hp / player.maxHp) * 100}%`;

    document.getElementById('xp-text').innerText = `${player.xp}/${player.xpNext}`;
    document.getElementById('level-text').innerText = player.level;
    document.getElementById('xp-bar').style.width = `${(player.xp / player.xpNext) * 100}%`;

    document.getElementById('stat-points').innerText = player.statPoints;
}

// --- RENDERIZADOR ---
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenhar Mundo (Apenas blocos visíveis na tela para otimização)
    let startX = Math.max(0, Math.floor(camera.x / TILE_SIZE));
    let endX = Math.min(WORLD_WIDTH, Math.ceil((camera.x + canvas.width) / TILE_SIZE));
    let startY = Math.max(0, Math.floor(camera.y / TILE_SIZE));
    let endY = Math.min(WORLD_HEIGHT, Math.ceil((camera.y + canvas.height) / TILE_SIZE));

    for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
            let block = world[x][y];
            if (block !== BLOCKS.AIR) {
                ctx.fillStyle = BLOCK_COLORS[block];
                ctx.fillRect(x * TILE_SIZE - camera.x, y * TILE_SIZE - camera.y, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.strokeRect(x * TILE_SIZE - camera.x, y * TILE_SIZE - camera.y, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    // Desenhar Jogador e Inimigos
    player.draw();
    enemies.forEach(e => e.draw());
}

// --- LOOP DO JOGO ---
function spawnEnemies() {
    if (enemies.length < 8) {
        let spawnX = player.x + (Math.random() - 0.5) * 800;
        let type = Math.random() > 0.5 ? 'slime' : 'zombie';
        enemies.push(new Enemy(spawnX, 100, type));
    }
}

function gameLoop() {
    player.update();
    enemies.forEach(e => e.update());
    render();
    requestAnimationFrame(gameLoop);
}

// Inicialização
generateWorld();
setInterval(spawnEnemies, 5000); // Spawna inimigo a cada 5 segundos
gameLoop();
