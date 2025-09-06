// WebGL setup
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");
const scoreEl = document.getElementById("score");
const overlayContent = document.getElementById("overlayContent");
const restartBtn = document.getElementById("restartBtn");
const jumpSound = document.getElementById("jumpSound");
const gameOverSound = document.getElementById("gameOverSound");

if (!gl) alert("WebGL not supported!");

// --- Shaders ---
const vertexShaderSrc = `
attribute vec2 a_position;
uniform vec2 u_resolution;
void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 zeroToTwo = zeroToOne * 2.0;
  vec2 clipSpace = zeroToTwo - 1.0;
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
}`;
const fragmentShaderSrc = `
precision mediump float;
uniform vec4 u_color;
void main() { gl_FragColor = u_color; }`;

function createShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(shader));
  return shader;
}

function createProgram(gl, vShader, fShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vShader);
  gl.attachShader(program, fShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(program));
  return program;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSrc);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSrc);
const program = createProgram(gl, vertexShader, fragmentShader);

const positionLoc = gl.getAttribLocation(program, "a_position");
const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
const colorLoc = gl.getUniformLocation(program, "u_color");

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.enableVertexAttribArray(positionLoc);
gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

// --- Game variables ---
const groundY = 260;
const dinoSize = { width: 40, height: 40 };
let dino = { x: 50, y: groundY - dinoSize.height, vy: 0, jump: false, animY: 0 };
let gravity = 0.8;
let obstacles = [];
let clouds = [];
let score = 0;
let speed = 4;
const minDistance = 350;
const maxDistance = 600;
let gameOver = false;

// --- Controls ---
function jump() {
  if (!dino.jump && !gameOver) {
    dino.vy = -15;
    dino.jump = true;
    jumpSound.currentTime = 0;
    jumpSound.play();
  }
}
document.addEventListener("keydown", e => {
  if (e.code === "Space" || e.code === "ArrowUp") jump();
});
canvas.addEventListener("touchstart", e => { e.preventDefault(); jump(); });

// Restart
restartBtn.addEventListener("click", () => {
  score = 0;
  speed = 4;
  obstacles = [];
  clouds = [];
  dino.y = groundY - dinoSize.height;
  dino.vy = 0;
  dino.jump = false;
  gameOver = false;
  overlayContent.classList.add("hidden");
  update();
});

// --- Game objects ---
function createObstacle() {
  const types = [
    { width: 20, height: 40 },
    { width: 30, height: 60 },
    { width: 45, height: 40 },
  ];
  const type = types[Math.floor(Math.random() * types.length)];
  return { x: canvas.width, y: groundY - type.height, width: type.width, height: type.height };
}

function canSpawnObstacle() {
  if (obstacles.length === 0) return true;
  const last = obstacles[obstacles.length - 1];
  const distance = Math.random() * (maxDistance - minDistance) + minDistance;
  return canvas.width - last.x >= distance;
}

function createCloud() {
  const y = Math.random() * 100 + 20;
  const size = Math.random() * 60 + 20;
  const speed = Math.random() * 0.5 + 0.2;
  return { x: canvas.width, y, size, speed };
}

function drawRect(x, y, w, h, color) {
  const verts = [
    x, y, x + w, y, x, y + h,
    x, y + h, x + w, y, x + w, y + h
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  gl.uniform4fv(colorLoc, color);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// --- Main game loop ---
function update() {
  if (gameOver) return;

  // Physics + smooth jump animation
  dino.y += dino.vy;
  dino.vy += gravity;
  if (dino.y > groundY - dinoSize.height) {
    dino.y = groundY - dinoSize.height;
    dino.jump = false;
  }

  // Clouds
  if (Math.random() < 0.02) clouds.push(createCloud());
  for (let i = clouds.length - 1; i >= 0; i--) {
    clouds[i].x -= clouds[i].speed * speed;
    if (clouds[i].x + clouds[i].size < 0) clouds.splice(i, 1);
  }

  // Obstacles
  if (canSpawnObstacle()) obstacles.push(createObstacle());
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].x -= speed;
    if (obstacles[i].x + obstacles[i].width < 0) obstacles.splice(i, 1);

    // Collision
    const ob = obstacles[i];
    if (
      dino.x < ob.x + ob.width &&
      dino.x + dinoSize.width > ob.x &&
      dino.y < ob.y + ob.height &&
      dino.y + dinoSize.height > ob.y
    ) {
      gameOver = true;
      overlayContent.classList.remove("hidden");
      gameOverSound.currentTime = 0;
      gameOverSound.play();
    }
  }

  // Score & speed
  score++;
  scoreEl.textContent = "Score: " + score;
  if (score % 1000 === 0) speed += 0.5;

  render();
  requestAnimationFrame(update);
}

// --- Rendering ---
function render() {
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0.933, 0.933, 0.933, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.uniform2f(resolutionLoc, canvas.width, canvas.height);

  // Ground
  drawRect(0, groundY, canvas.width, 40, [0.533, 0.533, 0.533, 1]);

  // Dino
  drawRect(dino.x, dino.y, dinoSize.width, dinoSize.height, [0.31, 0.28, 0.9, 1]);

  // Obstacles
  obstacles.forEach(ob => drawRect(ob.x, ob.y, ob.width, ob.height, [0.86, 0.15, 0.15, 1]));

  // Clouds
  clouds.forEach(cloud => drawRect(cloud.x, cloud.y, cloud.size, cloud.size / 2, [1, 1, 1, 0.8]));
}

update();
