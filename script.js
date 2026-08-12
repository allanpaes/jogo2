/**
 * TERRARIA 2D ENGINE (Canvas, ES6)
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- CONFIGURAÇÕES E CONSTANTES ---
const TILE_SIZE = 16;
const WORLD_WIDTH = 250;  // Largura do mapa em blocos
const WORLD_HEIGHT = 150; // Altura do mapa em blocos

// Tipos de Bloco
const TILES = {
    AIR: 0,
    DIRT: 1,
    GRASS: 2,
    STONE: 3,
    WOOD: 4,
    ORE: 5
};

const TILE_COLORS = {
    [TILES.DIRT]: '#8B4513',
    [TILES.GRASS]: '#2E8B57',
    [TILES.STONE]: '#708090',
    [TILES.WOOD]: '#A0522D',
    [TILES.ORE]: '#FFD700'
};

// --- SISTEMA DE CÂMERA ---
const camera = {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    follow(target) {
        this.x = target.x + target.width / 2 - this.width / 2;
        this.y = target.y + target.height / 2 - this.height / 2;
        
        // Limites do mundo
        this.x = Math.max(0, Math.min(this.x, WORLD_WIDTH * TILE_SIZE - this.width));
        this.y = Math.max(0, Math.min(this.y, WORLD_HEIGHT * TILE_SIZE - this.height));
    }
};

// --- GERAÇÃO PROCEDURAL DO MUNDO ---
class World {
    constructor() {
        this.map = new Array(WORLD_WIDTH * WORLD_HEIGHT).fill(TILES.AIR);
        this.generateTerrain();
    }

    getTile(x, y) {
        if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return TILES.STONE;
        return this.map[y * WORLD_WIDTH + x];
    }

    setTile(x, y, type) {
        if (x >= 0 && x < WORLD_WIDTH && y >= 0 && y < WORLD_HEIGHT) {
            this.map[y * WORLD_WIDTH + x] = type;
        }
    }

    generateTerrain() {
        // Gerador de superfície simplificado
        let surfaceY = 40;

        for (let x = 0; x < WORLD_WIDTH; x++) {
            // Suavização do terreno
            surfaceY += Math.floor((Math.random() - 0.5) * 3);
            surfaceY = Math.max(20, Math.min(60, surfaceY));

            for (let y = 0; y < WORLD_HEIGHT; y++) {
                if (y < surfaceY) {
                    this.setTile(x, y, TILES.AIR);
                } else if (y === surfaceY) {
                    this.setTile(x, y, TILES.GRASS);
                } else if (y < surfaceY + 10) {
                    this.setTile(x, y, TILES.DIRT);
                } else {
                    // Minérios aleatórios nas profundezas
                    if (Math.random() < 0.05) {
                        this.setTile(x, y, TILES.ORE);
                    } else {
                        this.setTile(x, y, TILES.STONE);
                    }
                }
            }
        }
    }

    draw(ctx, camera) {
        const startX = Math.floor(camera.x / TILE_SIZE);
        const endX = Math.ceil((camera.x + camera.width) / TILE_SIZE);
        const startY = Math.floor(camera.y / TILE_SIZE);
        const endY = Math.ceil((camera.y + camera.height) / TILE_SIZE);

        for (let x = startX; x < endX; x++) {
            for (let y = startY; y < endY; y++) {
                const tile = this.getTile(x, y);
                if (tile !== TILES.AIR) {
                    ctx.fillStyle = TILE_COLORS[tile] || '#fff';
                    ctx.fillRect(
                        Math.floor(x * TILE_SIZE - camera.x),
                        Math.floor(y * TILE_SIZE - camera.y),
                        TILE_SIZE,
                        TILE_SIZE
                    );
                }
            }
        }
    }
}

// --- CLASSE JOGADOR ---
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 14;
        this.height = 28;
        
        // Física
        this.vx = 0;
        this.vy = 0;
        this.speed = 2.5;
        this.jumpForce = -7.5;
        this.gravity = 0.35;
        this.grounded = false;

        // Atributos RPG & Level-Up
        this.level = 1;
        this.xp = 0;
        this.xpToNextLevel = 100;
        this.hp = 100;
        this.maxHp = 100;
        this.attack = 12;
        this.defense = 2;

        // Ferramentas / Ações
        this.selectedSlot = 1; // 1: Pickaxe, 2: Sword, 3: Dirt, 4: Stone, 5: Wood
        this.attackCooldown = 0;
    }

    gainXP(amount) {
        this.xp += amount;
        if (this.xp >= this.xpToNextLevel) {
            this.levelUp();
        }
        uiManager.updateStats(this);
    }

    levelUp() {
        this.xp -= this.xpToNextLevel;
        this.level++;
        this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);
        this.maxHp += 20;
        this.hp = this.maxHp;
        this.attack += 4;
        this.defense += 1;

        uiManager.showLevelPopup();
    }

    takeDamage(amount) {
        const finalDamage = Math.max(1, amount - this.defense);
        this.hp -= finalDamage;
        particleSystem.addText(this.x, this.y, `-${finalDamage}`, '#ff3333');
        
        if (this.hp <= 0) {
            this.hp = this.maxHp; // Respawn simples
            this.x = 100 * TILE_SIZE;
            this.y = 20 * TILE_SIZE;
        }
        uiManager.updateStats(this);
    }

    update(keys, world) {
        // Movimento Horizontal
        if (keys['KeyA'] || keys['ArrowLeft']) this.vx = -this.speed;
        else if (keys['KeyD'] || keys['ArrowRight']) this.vx = this.speed;
        else this.vx = 0;

        // Pulo
        if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && this.grounded) {
            this.vy = this.jumpForce;
            this.grounded = false;
        }

        // Gravidade
        this.vy += this.gravity;

        // Colisões AABB com o Mapa
        this.moveAndCollide(world);

        if (this.attackCooldown > 0) this.attackCooldown--;
    }

    moveAndCollide(world) {
        // Movimento X
        this.x += this.vx;
        let tiles = this.getIntersectingTiles(world);
        for (let t of tiles) {
            if (t.type !== TILES.AIR) {
                if (this.vx > 0) this.x = t.x * TILE_SIZE - this.width;
                else if (this.vx < 0) this.x = (t.x + 1) * TILE_SIZE;
                this.vx = 0;
            }
        }

        // Movimento Y
        this.y += this.vy;
        this.grounded = false;
        tiles = this.getIntersectingTiles(world);
        for (let t of tiles) {
            if (t.type !== TILES.AIR) {
                if (this.vy > 0) {
                    this.y = t.y * TILE_SIZE - this.height;
                    this.grounded = true;
                } else if (this.vy < 0) {
                    this.y = (t.y + 1) * TILE_SIZE;
                }
                this.vy = 0;
            }
        }
    }

    getIntersectingTiles(world) {
        const startX = Math.floor(this.x / TILE_SIZE);
        const endX = Math.floor((this.x + this.width) / TILE_SIZE);
        const startY = Math.floor(this.y / TILE_SIZE);
        const endY = Math.floor((this.y + this.height) / TILE_SIZE);

        let result = [];
        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const type = world.getTile(x, y);
                if (type !== TILES.AIR) {
                    result.push({ x, y, type });
                }
            }
        }
        return result;
    }

    draw(ctx, camera) {
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
        ctx.fillRect(
            Math.floor(this.x - camera.x),
            Math.floor(this.y - camera.y),
            this.width,
            this.height
        );
        ctx.shadowBlur = 0;
    }
}

// --- CLASSE INIMIGOS (IA) ---
class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'slime' ou 'eye'
        this.width = type === 'slime' ? 20 : 16;
        this.height = type === 'slime' ? 14 : 16;
        
        this.hp = type === 'slime' ? 30 : 20;
        this.maxHp = this.hp;
        this.damage = type === 'slime' ? 8 : 12;
        this.xpValue = type === 'slime' ? 25 : 40;

        this.vx = 0;
        this.vy = 0;
        this.color = type === 'slime' ? '#32cd32' : '#ff0055';
    }

    update(player, world) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Perseguição se o jogador estiver próximo
        if (dist < 250) {
            if (this.type === 'slime') {
                this.vx = dx > 0 ? 1 : -1;
                // Pulo automático ao encarar obstáculos
                if (Math.random() < 0.02 && this.vy === 0) {
                    this.vy = -5;
                }
                this.vy += 0.35; // Gravidade
            } else if (this.type === 'eye') {
                // Inimigo voador
                this.vx = (dx / dist) * 1.5;
                this.vy = (dy / dist) * 1.5;
            }
        } else {
            this.vx = 0;
            if (this.type === 'slime') this.vy += 0.35;
        }

        // Aplicação básica de movimento simples
        this.x += this.vx;
        this.y += this.vy;

        // Limite no Chão para Slimes
        if (this.type === 'slime') {
            const tileY = Math.floor((this.y + this.height) / TILE_SIZE);
            const tileX = Math.floor(this.x / TILE_SIZE);
            if (world.getTile(tileX, tileY) !== TILES.AIR) {
                this.y = (tileY * TILE_SIZE) - this.height;
                this.vy = 0;
            }
        }
    }

    takeDamage(amount, player) {
        this.hp -= amount;
        particleSystem.addText(this.x, this.y, `-${amount}`, '#ffffff');
        
        // Knockback simples
        this.vx = player.x < this.x ? 4 : -4;
        this.vy = -2;

        if (this.hp <= 0) {
            player.gainXP(this.xpValue);
            return true; // Morto
        }
        return false;
    }

    draw(ctx, camera) {
        ctx.fillStyle = this.color;
        ctx.fillRect(
            Math.floor(this.x - camera.x),
            Math.floor(this.y - camera.y),
            this.width,
            this.height
        );
    }
}

// --- SISTEMA DE PARTÍCULAS E NÚMEROS DE DANO ---
class ParticleSystem {
    constructor() {
        this.particles = [];
        this.texts = [];
    }

    addText(x, y, text, color) {
        this.texts.push({ x, y, text, color, alpha: 1, vy: -1 });
    }

    addBlockParticles(x, y, color) {
        for (let i = 0; i < 6; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                size: Math.random() * 3 + 1,
                color,
                life: 20
            });
        }
    }

    update() {
        // Partículas
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // Textos de Dano
        for (let i = this.texts.length - 1; i >= 0; i--) {
            let t = this.texts[i];
            t.y += t.vy;
            t.alpha -= 0.02;
            if (t.alpha <= 0) this.texts.splice(i, 1);
        }
    }

    draw(ctx, camera) {
        // Renderizar Partículas
        for (let p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - camera.x, p.y - camera.y, p.size, p.size);
        }

        // Renderizar Texto Flutuante
        ctx.font = 'bold 12px Consolas';
        for (let t of this.texts) {
            ctx.save();
            ctx.globalAlpha = t.alpha;
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, t.x - camera.x, t.y - camera.y);
            ctx.restore();
        }
    }
}

// --- UI MANAGER ---
class UIManager {
    constructor() {
        this.hpBar = document.getElementById('hp-bar');
        this.hpText = document.getElementById('hp-text');
        this.xpBar = document.getElementById('xp-bar');
        this.xpText = document.getElementById('xp-text');
        this.levelDisplay = document.getElementById('level-display');
        this.atqVal = document.getElementById('atq-val');
        this.defVal = document.getElementById('def-val');
        this.levelPopup = document.getElementById('level-popup');
        this.slots = document.querySelectorAll('.slot');
    }

    updateStats(player) {
        const hpPercent = Math.max(0, (player.hp / player.maxHp) * 100);
        const xpPercent = Math.min(100, (player.xp / player.xpToNextLevel) * 100);

        this.hpBar.style.width = `${hpPercent}%`;
        this.hpText.innerText = `${player.hp} / ${player.maxHp}`;
        this.xpBar.style.width = `${xpPercent}%`;
        this.xpText.innerText = `${player.xp}/${player.xpToNextLevel}`;
        this.levelDisplay.innerText = player.level;
        this.atqVal.innerText = player.attack;
        this.defVal.innerText = player.defense;
    }

    setActiveSlot(slotIndex) {
        this.slots.forEach(slot => slot.classList.remove('active'));
        const active = document.querySelector(`.slot[data-slot="${slotIndex}"]`);
        if (active) active.classList.add('active');
    }

    showLevelPopup() {
        this.levelPopup.classList.remove('hidden');
        setTimeout(() => this.levelPopup.classList.add('hidden'), 1500);
    }
}

// --- INICIALIZAÇÃO E LOOP DO JOGO ---
const world = new World();
const player = new Player(120 * TILE_SIZE, 30 * TILE_SIZE);
const particleSystem = new ParticleSystem();
const uiManager = new UIManager();

let enemies = [
    new Enemy(110 * TILE_SIZE, 30 * TILE_SIZE, 'slime'),
    new Enemy(130 * TILE_SIZE, 30 * TILE_SIZE, 'slime'),
    new Enemy(125 * TILE_SIZE, 20 * TILE_SIZE, 'eye')
];

// Mapeamento de Controles
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)) {
        player.selectedSlot = parseInt(e.code.replace('Digit', ''));
        uiManager.setActiveSlot(player.selectedSlot);
    }
});
window.addEventListener('keyup', e => keys[e.code] = false);

// Ações do Mouse (Quebrar / Construir / Atacar)
canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left + camera.x;
    const mouseY = e.clientY - rect.top + camera.y;

    const tileX = Math.floor(mouseX / TILE_SIZE);
    const tileY = Math.floor(mouseY / TILE_SIZE);

    // Distância máxima de alcance (Alcance de mineração)
    const pCenterX = player.x + player.width / 2;
    const pCenterY = player.y + player.height / 2;
    const dist = Math.hypot(mouseX - pCenterX, mouseY - pCenterY);

    if (dist < 120) { // Alcance de interatividade
        if (player.selectedSlot === 1) { 
            // PICARETA: Minar Bloco
            const currentTile = world.getTile(tileX, tileY);
            if (currentTile !== TILES.AIR) {
                particleSystem.addBlockParticles(mouseX, mouseY, TILE_COLORS[currentTile]);
                world.setTile(tileX, tileY, TILES.AIR);
                player.gainXP(5); // XP por mineração
            }
        } else if (player.selectedSlot === 2) {
            // ESPADA: Atacar Inimigos
            if (player.attackCooldown <= 0) {
                player.attackCooldown = 15;
                enemies.forEach((enemy, index) => {
                    const eDist = Math.hypot((enemy.x + enemy.width/2) - mouseX, (enemy.y + enemy.height/2) - mouseY);
                    if (eDist < 30) {
                        const isDead = enemy.takeDamage(player.attack, player);
                        if (isDead) enemies.splice(index, 1);
                    }
                });
            }
        } else {
            // CONSTRUÇÃO: Colocar Bloco (Slots 3, 4, 5)
            const tileToPlace = player.selectedSlot === 3 ? TILES.DIRT : 
                               (player.selectedSlot === 4 ? TILES.STONE : TILES.WOOD);
            
            if (world.getTile(tileX, tileY) === TILES.AIR) {
                world.setTile(tileX, tileY, tileToPlace);
            }
        }
    }
});

// Loop Principal
function gameLoop() {
    // 1. Atualizações
    player.update(keys, world);
    camera.follow(player);

    // Atualiza Inimigos & Colisões com o Jogador
    enemies.forEach(enemy => {
        enemy.update(player, world);

        // Colisão com o Jogador (Dano)
        if (
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y
        ) {
            player.takeDamage(enemy.damage);
        }
    });

    // Spawn Dinâmico de Inimigos
    if (enemies.length < 5 && Math.random() < 0.005) {
        const spawnX = player.x + (Math.random() - 0.5) * 500;
        const spawnY = player.y - 100;
        const type = Math.random() > 0.5 ? 'slime' : 'eye';
        enemies.push(new Enemy(spawnX, spawnY, type));
    }

    particleSystem.update();

    // 2. Renderização
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    world.draw(ctx, camera);
    player.draw(ctx, camera);
    enemies.forEach(enemy => enemy.draw(ctx, camera));
    particleSystem.draw(ctx, camera);

    requestAnimationFrame(gameLoop);
}

// Inicia
uiManager.updateStats(player);
requestAnimationFrame(gameLoop);
