// CONFIGURAÇÕES E ESTADO DO JOGO
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Elementos da Interface
const currentScoreElement = document.getElementById("current-score");
const highScoreElement = document.getElementById("high-score");
const finalScoreElement = document.getElementById("final-score");
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");

// Botões Mobile
const btnUp = document.getElementById("btn-up");
const btnDown = document.getElementById("btn-down");
const btnLeft = document.getElementById("btn-left");
const btnRight = document.getElementById("btn-right");

// Constantes do Grid
const GRID_SIZE = 20; // 20x20 blocos
const TILE_SIZE = canvas.width / GRID_SIZE;

// Estado do Jogo
let snake = [];
let food = { x: 0, y: 0 };
let dx = 1; // Direção X (-1, 0, 1)
let dy = 0; // Direção Y (-1, 0, 1)
let nextDx = 1;
let nextDy = 0;

let score = 0;
let highScore = localStorage.getItem("snake_high_score") || 0;
let gameInterval = null;
let isPaused = false;
let isRunning = false;
const GAME_SPEED = 100; // Milissegundos por quadro

// INICIALIZAÇÃO
highScoreElement.textContent = highScore;

// EVENT LISTENERS
startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

document.addEventListener("keydown", handleKeyPress);

// Suporte a Controles Touch/Mobile
btnUp.addEventListener("click", () => setDirection(0, -1));
btnDown.addEventListener("click", () => setDirection(0, 1));
btnLeft.addEventListener("click", () => setDirection(-1, 0));
btnRight.addEventListener("click", () => setDirection(1, 0));

// FUNÇÕES PRINCIPAIS DO JOGO

function startGame() {
  // Reseta variáveis do estado
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
  ];
  dx = 1;
  dy = 0;
  nextDx = 1;
  nextDy = 0;
  score = 0;
  isPaused = false;
  isRunning = true;

  currentScoreElement.textContent = score;
  
  // Esconde telas de overlay
  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");

  // Gera a primeira comida
  spawnFood();

  // Inicia o loop do jogo
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, GAME_SPEED);
}

function gameLoop() {
  if (isPaused) return;

  updatePosition();
  
  if (checkCollision()) {
    handleGameOver();
    return;
  }

  draw();
}

// LÓGICA DO JOGO

function updatePosition() {
  // Aplica a nova direção pendente
  dx = nextDx;
  dy = nextDy;

  // Cria a nova cabeça
  const head = { x: snake[0].x + dx, y: snake[0].y + dy };
  snake.unshift(head);

  // Verifica se comeu a fruta
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    currentScoreElement.textContent = score;

    if (score > highScore) {
      highScore = score;
      highScoreElement.textContent = highScore;
      localStorage.setItem("snake_high_score", highScore);
    }

    spawnFood();
  } else {
    // Se não comeu, remove a cauda normalmente
    snake.pop();
  }
}

function setDirection(newDx, newDy) {
  // Impede o jogador de fazer uma volta de 180 graus instantânea
  const goingUp = dy === -1;
  const goingDown = dy === 1;
  const goingRight = dx === 1;
  const goingLeft = dx === -1;

  if (newDx === -1 && !goingRight) { nextDx = -1; nextDy = 0; }
  if (newDx === 1 && !goingLeft) { nextDx = 1; nextDy = 0; }
  if (newDy === -1 && !goingDown) { nextDx = 0; nextDy = -1; }
  if (newDy === 1 && !goingUp) { nextDx = 0; nextDy = 1; }
}

function handleKeyPress(e) {
  if (!isRunning) return;

  // Prevenir rolagem da página com as setas e espaço
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }

  // Tecla de Pausa (Espaço)
  if (e.key === " " || e.key === "Spacebar") {
    isPaused = !isPaused;
    return;
  }

  if (isPaused) return;

  // Controles W, A, S, D e Setas
  switch (e.key) {
    case "ArrowUp":
    case "w":
    case "W":
      setDirection(0, -1);
      break;
    case "ArrowDown":
    case "s":
    case "S":
      setDirection(0, 1);
      break;
    case "ArrowLeft":
    case "a":
    case "A":
      setDirection(-1, 0);
      break;
    case "ArrowRight":
    case "d":
    case "D":
      setDirection(1, 0);
      break;
  }
}

function spawnFood() {
  let validPosition = false;

  while (!validPosition) {
    food.x = Math.floor(Math.random() * GRID_SIZE);
    food.y = Math.floor(Math.random() * GRID_SIZE);

    // Garante que a fruta não vai nascer em cima do corpo da cobra
    validPosition = !snake.some(segment => segment.x === food.x && segment.y === food.y);
  }
}

function checkCollision() {
  const head = snake[0];

  // Colisão com as paredes
  const hitLeftWall = head.x < 0;
  const hitRightWall = head.x >= GRID_SIZE;
  const hitTopWall = head.y < 0;
  const hitBottomWall = head.y >= GRID_SIZE;

  if (hitLeftWall || hitRightWall || hitTopWall || hitBottomWall) {
    return true;
  }

  // Colisão com o próprio corpo
  for (let i = 1; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) {
      return true;
    }
  }

  return false;
}

function handleGameOver() {
  clearInterval(gameInterval);
  isRunning = false;
  finalScoreElement.textContent = score;
  gameOverScreen.classList.remove("hidden");
}

// RENDERIZAÇÃO / DESENHO NO CANVAS

function draw() {
  // Limpa a tela
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Desenha a grade (Grid sutil de fundo)
  drawGrid();

  // Desenha a comida
  drawFood();

  // Desenha a cobra
  drawSnake();
}

function drawGrid() {
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1;

  for (let x = 0; x < canvas.width; x += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y < canvas.height; y += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawSnake() {
  snake.forEach((segment, index) => {
    // Cabeça verde clara, corpo verde padrão
    if (index === 0) {
      ctx.fillStyle = "#86efac";
    } else {
      ctx.fillStyle = "#22c55e";
    }

    // Preenche o quadrado
    ctx.fillRect(
      segment.x * TILE_SIZE + 1,
      segment.y * TILE_SIZE + 1,
      TILE_SIZE - 2,
      TILE_SIZE - 2
    );

    // Bordas arredondadas nos blocos da cobra
    ctx.strokeStyle = "#15803d";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      segment.x * TILE_SIZE + 1,
      segment.y * TILE_SIZE + 1,
      TILE_SIZE - 2,
      TILE_SIZE - 2
    );
  });
}

function drawFood() {
  ctx.fillStyle = "#ef4444";
  
  // Desenha a fruta como um círculo preenchido
  const centerX = food.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = food.y * TILE_SIZE + TILE_SIZE / 2;
  const radius = TILE_SIZE / 2 - 2;

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  // Detalhe de brilho na fruta
  ctx.fillStyle = "#fca5a5";
  ctx.beginPath();
  ctx.arc(centerX - radius / 3, centerY - radius / 3, radius / 3, 0, Math.PI * 2);
  ctx.fill();
}
