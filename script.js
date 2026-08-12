// ============================================================================
// CONSTANTES & CONFIGURAÇÕES TÉCNICAS
// ============================================================================
const TILE = 32;
const WORLD_W = 300;  // Largura em blocos (9600px de mundo)
const WORLD_H = 150;  // Altura em blocos (4800px de profundidade)
const GRAVITY = 0.45;

const BLOCKS = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    COAL: 4,
    IRON: 5,
    GOLD: 6,
    WOOD: 7,
    LEAVES: 8
};

const BLOCK_DATA = {
    [BLOCKS.GRASS]: { name: 'Grama', color: '#2ecc71', hp: 2 },
    [BLOCKS.DIRT]:  { name: 'Terra', color: '#795548', hp: 2 },
    [BLOCKS.STONE]: { name: 'Pedra', color: '#7f8c8d', hp: 5 },
    [BLOCKS.COAL]:  { name: 'Carvão', color: '#2c3e50', hp: 6 },
    [BLOCKS.IRON]:  { name: 'Ferro', color: '#bdc3c7', hp: 8 },
    [BLOCKS.GOLD]:  { name: 'Ouro', color: '#f1c40f', hp: 12 },
    [BLOCKS.WOOD]:  { name: 'Mad.',  color: '#8d6e63', hp: 3 },
    [BLOCKS.LEAVES]:{ name: 'Folha', color: '#27ae60', hp: 1 }
};

// SIMULADOR DE RUÍDO SUAVE PARA GERAR TERRENO
function pseudoNoise(x) {
    return Math.sin(x * 0.03) * 12 + Math.sin(x * 0.1) * 4 + Math.cos(x * 0.005) * 20;
}

// ============================================================================
// CLASSE ENGINE DO MUNDO E RENDERIZADOR
// ============================================================================
class World {
    constructor() {
        this.grid = new Array(WORLD_W).fill(0).map(() => new Array(WORLD_H).fill(BLOCKS.AIR));
        this.drops = [];
        this.generate();
    }

    generate() {
        const surfaceBase = 40;

        for (let x = 0; x < WORLD_W; x++) {
            let heightOffset = Math.floor(pseudoNoise(x));
            let surfaceY = surfaceBase + heightOffset;

            for (let y = 0; y < WORLD_H; y++) {
                if (y < surfaceY) {
                    this.grid[x][y] = BLOCKS.AIR;
                } else if (y === surfaceY) {
                    this.grid[x][y] = BLOCKS.GRASS;
                } else if (y < surfaceY + 8) {
                    this.grid[x][y] = BLOCKS.DIRT;
                } else {
                    // Cavernas e Minérios
                    let caveChance = Math.sin(x * 0.1) * Math.cos(y * 0.1);
                    if (caveChance > 0.45 && y > surfaceY + 12) {
                        this.grid[x][y] = BLOCKS.AIR;
                    } else {
                        // Rarity of ores based on depth
                        let rand = Math.random();
                        if (rand < 0.02 && y > surfaceY + 40) this.grid[x][y] = BLOCKS.GOLD;
                        else if (rand < 0.05 && y > surfaceY + 20) this.grid[x][y] = BLOCKS.IRON;
                        else if (rand < 0.1) this.grid[x][y] = BLOCKS.COAL;
                        else this.grid[x][y] = BLOCKS.STONE;
                    }
                }
            }

            // Gerar Árvores
            if (x > 5 && x < WORLD_W - 5 && Math.random() < 0.15) {
                if (this.grid[x][surfaceY] === BLOCKS.GRASS) {
                    this.generateTree(x, surfaceY - 1);
                }
            }
        }
    }

    generateTree(x, startY) {
        let trunkHeight = Math.floor(Math.random() * 3) + 4;
        for (let i = 0; i < trunkHeight; i++) {
            if (startY - i > 0) this.grid[x][startY - i] = BLOCKS.WOOD;
        }
        let topY = startY - trunkHeight;
        for (let lx = x - 2; lx <= x + 2; lx++) {
            for (let ly = topY - 2; ly <= topY; ly++) {
                if (lx >= 0 && lx < WORLD_W && ly >= 0) {
                    if (this.grid[lx][ly] === BLOCKS.AIR) {
                        this.grid[lx][ly] = BLOCKS.LEAVES;
                    }
                }
            }
        }
    }

    getBlock(x, y) {
        if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return BLOCKS.STONE; // Limites sólidos
        return this.grid[x][y];
    }

    setBlock(x, y, type) {
        if (x >= 0 && x < WORLD_W && y >= 0 && y < WORLD_H) {
            this.grid[x][y] = type;
        }
    }
}

// ============================================================================
// ENTIDADES: JOGADOR E INIMIGOS
// ============================================================================
class Entity {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.vx = 0;
        this.vy = 0;
        this.grounded = false;
    }

    updatePhysics(world) {
        this.vy += GRAVITY;

        // Movimento Horizontal
        this.x += this.vx;
        this.collideX(world);

        // Movimento Vertical
        this.y += this.vy;
        this.collideY(world);
    }

    collideX(world) {
        let left = Math.floor(this.x / TILE);
        let right = Math.floor((this.x + this.w) / TILE);
        let top = Math.floor(this.y / TILE);
        let bottom = Math.floor((this.y + this.h - 0.1) / TILE);

        for (let x = left; x <= right; x++) {
            for (let y = top; y <= bottom; y++) {
                if (world.getBlock(x, y) !== BLOCKS.AIR) {
                    if (this.vx > 0) this.x = x * TILE - this.w;
                    if (this.vx < 0) this.x = (x + 1) * TILE;
                    this.vx = 0;
                    return;
                }
            }
        }
    }

    collideY(world) {
        let left = Math.floor(this.x / TILE);
        let right = Math.floor((this.x + this.w - 0.1) / TILE);
        let top = Math.floor(this.y / TILE);
        let bottom = Math.floor((this.y + this.h) / TILE);

        this.grounded = false;

        for (let x = left; x <= right; x++) {
            for (let y = top; y <= bottom; y++) {
                if (world.getBlock(x, y) !== BLOCKS.AIR) {
                    if (this.vy > 0) {
                        this.y = y * TILE - this.h;
                        this.grounded = true;
                        this.vy = 0;
                    } else if (this.vy < 0) {
                        this.y = (y + 1) * TILE;
                        this.vy = 0;
                    }
                    return;
                }
            }
        }
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 22, 52);
        this.speed = 4.5;
        this.jumpPower = 10;
        
        // Stats RPG
        this.level = 1;
        this.xp = 0;
        this.xpNext = 100;
        this.hp = 100;
        this.maxHp = 100;
        this.damage = 12;
        this.statPoints = 0;

        this.inventory = {
            [BLOCKS.DIRT]: 20,
            [BLOCKS.WOOD]: 10
        };
        this.selectedSlot = BLOCKS.DIRT;
    }

    update(input, world) {
        if (input.left) this.vx = -this.speed;
        else if (input.right) this.vx = this.speed;
        else this.vx = 0;

        if (input.jump && this.grounded) {
            this.vy = -this.jumpPower;
        }

        this.updatePhysics(world);
    }

    addXP(amount) {
        this.xp += amount;
        while (this.xp >= this.xpNext) {
            this.xp -= this.xpNext;
            this.level++;
            this.xpNext = Math.floor(this.xpNext * 1.6);
            this.statPoints += 2;
            this.maxHp += 15;
            this.hp = this.maxHp;
        }
    }

    upgrade(stat) {
        if (this.statPoints <= 0) return;
        if (stat === 'hp') { this.maxHp += 20; this.hp += 20; }
        if (stat === 'damage') { this.damage += 4; }
        if (stat === 'speed') { this.speed += 0.4; }
        this.statPoints--;
    }

    draw(ctx, cam) {
        ctx.fillStyle = '#e74c3c'; // Corpo
        ctx.fillRect(this.x - cam.x, this.y - cam.y, this.w, this.h);
        
        // Olho/Cabeça
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x - cam.x + (this.vx >= 0 ? 12 : 2), this.y - cam.y + 8, 8, 8);
    }
}

class Enemy extends Entity {
    constructor(x, y, type) {
        let size = type === 'slime' ? [28, 20] : [24, 48];
        super(x, y, size[0], size[1]);
        this.type = type;
        
        if (type === 'slime') {
            this.hp = 30; this.maxHp = 30; this.damage = 8; this.xp = 30; this.color = '#2ecc71';
        } else if (type === 'zombie') {
            this.hp = 70; this.maxHp = 70; this.damage = 16; this.xp = 75; this.color = '#16a085';
        } else if (type === 'demon') {
            this.hp = 120; this.maxHp = 120; this.damage = 25; this.xp = 150; this.color = '#8e44ad';
        }
    }

    update(player, world) {
        // IA de Perseguição Simples
        let dir = player.x > this.x ? 1 : -1;
        this.vx = dir * (this.type === 'slime' ? 1.5 : 2);

        // Slime Pula enquanto anda
        if (this.type === 'slime' && this.grounded && Math.random() < 0.03) {
            this.vy = -6;
        }

        // Zumbi pula obstáculos
        if (this.grounded && (this.vx > 0 || this.vx < 0)) {
            let checkX = Math.floor((this.x + (this.vx > 0 ? this.w + 4 : -4)) / TILE);
            let checkY = Math.floor((this.y + this.h - 8) / TILE);
            if (world.getBlock(checkX, checkY) !== BLOCKS.AIR) {
                this.vy = -8;
            }
        }

        this.updatePhysics(world);

        // Dano no Jogador
        if (this.collidesWith(player)) {
            player.hp -= this.damage * 0.02; // Dano contínuo por frame de contato
        }
    }

    collidesWith(ent) {
        return (this.x < ent.x + ent.w && this.x + this.w > ent.x &&
                this.y < ent.y + ent.h && this.y + this.h > ent.y);
    }

    draw(ctx, cam) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - cam.x, this.y - cam.y, this.w, this.h);

        // Barra de Vida do Inimigo
        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - cam.x, this.y - cam.y - 8, this.w, 4);
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(this.x - cam.x, this.y - cam.y - 8, (this.w * (this.hp / this.maxHp)), 4);
        }
    }
}

// ============================================================================
// LOOP PRINCIPAL E CONTROLADOR
// ============================================================================
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        this.world = new World();
        
        // Nascer o jogador acima da superfície do centro do mundo
        let startX = (WORLD_W / 2) * TILE;
        this.player = new Player(startX, 0);

        this.enemies = [];
        this.camera = { x: 0, y: 0 };
        this.input = { left: false, right: false, jump: false };
        this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, button: 0 };

        this.initEvents();
        this.buildHotbar();
        
        // Loop principal
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));

        // Spawner de inimigos
        setInterval(() => this.spawnEnemies(), 4000);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initEvents() {
        window.addEventListener('resize', () => this.resize());

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.input.left = true;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') this.input.right = true;
            if (e.code === 'KeyW' || e.code === 'Space' || e.code === 'ArrowUp') this.input.jump = true;
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.input.left = false;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') this.input.right = false;
            if (e.code === 'KeyW' || e.code === 'Space' || e.code === 'ArrowUp') this.input.jump = false;
        });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mousedown', (e) => {
            this.mouse.down = true;
            this.mouse.button = e.button;
            this.handleMouseClick();
        });

        window.addEventListener('mouseup', () => this.mouse.down = false);
        window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    handleMouseClick() {
        let blockX = Math.floor(this.mouse.worldX / TILE);
        let blockY = Math.floor(this.mouse.worldY / TILE);

        // Alcançar distância máxima
        let pTileX = Math.floor((this.player.x + this.player.w / 2) / TILE);
        let pTileY = Math.floor((this.player.y + this.player.h / 2) / TILE);
        let dist = Math.hypot(blockX - pTileX, blockY - pTileY);

        if (dist > 7) return; // Alcance máximo do clique

        if (this.mouse.button === 0) { // Clique Esquerdo: Atacar / Quebrar
            // Checar clique em Inimigo
            let hitEnemy = false;
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                let e = this.enemies[i];
                if (this.mouse.worldX >= e.x && this.mouse.worldX <= e.x + e.w &&
                    this.mouse.worldY >= e.y && this.mouse.worldY <= e.y + e.h) {
                    
                    e.hp -= this.player.damage;
                    hitEnemy = true;
                    if (e.hp <= 0) {
                        this.player.addXP(e.xp);
                        this.enemies.splice(i, 1);
                    }
                    break;
                }
            }

            // Se não clicou em inimigo, quebra o bloco
            if (!hitEnemy) {
                let currentBlock = this.world.getBlock(blockX, blockY);
                if (currentBlock !== BLOCKS.AIR) {
                    // Adicionar ao inventário
                    this.player.inventory[currentBlock] = (this.player.inventory[currentBlock] || 0) + 1;
                    this.world.setBlock(blockX, blockY, BLOCKS.AIR);
                    this.updateHUD();
                }
            }

        } else if (this.mouse.button === 2) { // Clique Direito: Construir
            if (this.world.getBlock(blockX, blockY) === BLOCKS.AIR) {
                let selected = this.player.selectedSlot;
                if (this.player.inventory[selected] > 0) {
                    this.world.setBlock(blockX, blockY, selected);
                    this.player.inventory[selected]--;
                    this.updateHUD();
                }
            }
        }
    }

    spawnEnemies() {
        if (this.enemies.length >= 12) return;

        let spawnDist = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 400 + 400);
        let spawnX = this.player.x + spawnDist;
        let tileX = Math.floor(spawnX / TILE);

        if (tileX > 2 && tileX < WORLD_W - 2) {
            // Encontrar o chão
            for (let y = 0; y < WORLD_H; y++) {
                if (this.world.getBlock(tileX, y) !== BLOCKS.AIR) {
                    let type = 'slime';
                    let rand = Math.random();
                    if (rand > 0.7) type = 'zombie';
                    if (rand > 0.92 && this.player.level > 3) type = 'demon';

                    this.enemies.push(new Enemy(tileX * TILE, (y - 2) * TILE, type));
                    break;
                }
            }
        }
    }

    updateCamera() {
        // Câmera suave focada no jogador
        let targetX = this.player.x + this.player.w / 2 - this.canvas.width / 2;
        let targetY = this.player.y + this.player.h / 2 - this.canvas.height / 2;

        this.camera.x += (targetX - this.camera.x) * 0.1;
        this.camera.y += (targetY - this.camera.y) * 0.1;

        // Limites do mundo para a câmera
        this.camera.x = Math.max(0, Math.min(this.camera.x, WORLD_W * TILE - this.canvas.width));
        this.camera.y = Math.max(0, Math.min(this.camera.y, WORLD_H * TILE - this.canvas.height));

        // Posição do Mouse no Mundo
        this.mouse.worldX = this.mouse.x + this.camera.x;
        this.mouse.worldY = this.mouse.y + this.camera.y;
    }

    buildHotbar() {
        const hotbarEl = document.getElementById('hotbar');
        hotbarEl.innerHTML = '';
        
        let availableBlocks = [BLOCKS.DIRT, BLOCKS.STONE, BLOCKS.WOOD, BLOCKS.COAL, BLOCKS.IRON];
        
        availableBlocks.forEach((bId, idx) => {
            let count = this.player.inventory[bId] || 0;
            let slot = document.createElement('div');
            slot.className = `slot ${this.player.selectedSlot === bId ? 'active' : ''}`;
            slot.innerHTML = `
                <span class="slot-key">${idx + 1}</span>
                <div class="slot-icon" style="background: ${BLOCK_DATA[bId].color}"></div>
                <span class="slot-count" id="slot-cnt-${bId}">${count}</span>
            `;
            slot.onclick = () => {
                this.player.selectedSlot = bId;
                this.buildHotbar();
            };
            hotbarEl.appendChild(slot);
        });
    }

    updateHUD() {
        // Atualiza barras
        document.getElementById('hp-bar').style.width = `${Math.max(0, (this.player.hp / this.player.maxHp) * 100)}%`;
        document.getElementById('hp-text').innerText = `${Math.ceil(Math.max(0, this.player.hp))}/${this.player.maxHp}`;
        
        document.getElementById('xp-bar').style.width = `${(this.player.xp / this.player.xpNext) * 100}%`;
        document.getElementById('xp-text').innerText = `${this.player.xp}/${this.player.xpNext}`;
        
        document.getElementById('level-num').innerText = this.player.level;
        document.getElementById('stat-points').innerText = this.player.statPoints;

        // Atualiza contadores do Inventário
        for (let bId in BLOCK_DATA) {
            let el = document.getElementById(`slot-cnt-${bId}`);
            if (el) el.innerText = this.player.inventory[bId] || 0;
        }
    }

    loop(timestamp) {
        // Atualizações de Lógica
        this.player.update(this.input, this.world);
        this.enemies.forEach(e => e.update(this.player, this.world));
        this.updateCamera();
        this.updateHUD();

        // Renderização
        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }

    render() {
        // Céu
        this.ctx.fillStyle = '#1a252c';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Renderização do Mundo (Apenas o que é visível na viewport)
        let startX = Math.max(0, Math.floor(this.camera.x / TILE));
        let endX = Math.min(WORLD_W, Math.ceil((this.camera.x + this.canvas.width) / TILE));
        let startY = Math.max(0, Math.floor(this.camera.y / TILE));
        let endY = Math.min(WORLD_H, Math.ceil((this.camera.y + this.canvas.height) / TILE));

        for (let x = startX; x < endX; x++) {
            for (let y = startY; y < endY; y++) {
                let type = this.world.getBlock(x, y);
                if (type !== BLOCKS.AIR) {
                    this.ctx.fillStyle = BLOCK_DATA[type].color;
                    this.ctx.fillRect(
                        Math.floor(x * TILE - this.camera.x), 
                        Math.floor(y * TILE - this.camera.y), 
                        TILE, TILE
                    );
                    
                    // Borda sutil de bloco
                    this.ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                    this.ctx.strokeRect(
                        Math.floor(x * TILE - this.camera.x), 
                        Math.floor(y * TILE - this.camera.y), 
                        TILE, TILE
                    );
                }
            }
        }

        // Renderizar Inimigos e Player
        this.enemies.forEach(e => e.draw(this.ctx, this.camera));
        this.player.draw(this.ctx, this.camera);

        // Indicador de Mira/Mineração na Grade
        let hoverX = Math.floor(this.mouse.worldX / TILE);
        let hoverY = Math.floor(this.mouse.worldY / TILE);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(
            hoverX * TILE - this.camera.x, 
            hoverY * TILE - this.camera.y, 
            TILE, TILE
        );
        this.ctx.lineWidth = 1;
    }
}

// Inicializar o jogo assim que a página carregar
let game;
window.onload = () => {
    game = new Game();
};
