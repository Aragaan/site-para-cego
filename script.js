const $ = id => document.getElementById(id);

const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE = 48;

const map = [
  "###############",
  "#.............#",
  "#.#####.#####.#",
  "#.....#.#.....#",
  "#####.#.#.#####",
  "#.....#.#.....#",
  "#.#####.#####.#",
  "#.............#",
  "###############"
];

const directions = ["Norte", "Leste", "Sul", "Oeste"];

const exit = { x: 13, y: 7 };
const monsterStart = { x: 11, y: 3 };

let player;
let monster;
let running = false;
let voiceReady = false;
let lastVoice = "";

function resetWorld() {
  player = {
    x: 1,
    y: 1,
    dir: 2,
    health: 100
  };

  monster = {
    x: monsterStart.x,
    y: monsterStart.y,
    step: 0
  };

  updateHUD();
  draw();
}

function speak(text, force = false) {
  if (!voiceReady || !("speechSynthesis" in window)) return;
  if (!force && text === lastVoice) return;

  lastVoice = text;
  speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = "pt-BR";
  u.rate = 0.95;
  u.pitch = 1;
  u.volume = 1;

  speechSynthesis.speak(u);
}

function initVoice() {
  voiceReady = true;
  speak(
    "Narração ativada. Pressione Tab para navegar. " +
    "Cada elemento será lido.",
    true
  );
}

function describe(el) {
  if (!el) return "";

  let name =
    el.getAttribute("aria-label") ||
    el.innerText ||
    el.textContent ||
    "";

  name = name.replace(/\s+/g, " ").trim();

  if (!name) return "";

  let type = "";
  if (el.tagName === "BUTTON") type = "Botão.";
  else if (el.tagName === "CANVAS") type = "Área do jogo.";
  else if (el.tagName === "H1" || el.tagName === "H2") type = "Título.";
  else if (el.tagName === "P") type = "Texto.";

  return `${name}. ${type}`;
}

/* TAB = leitura de absolutamente todos os elementos focáveis. */
document.addEventListener("focusin", e => {
  const text = describe(e.target);
  if (text) speak(text, true);
});

document.addEventListener("keydown", e => {
  if (e.key === "Tab") {
    if (!voiceReady) initVoice();

    setTimeout(() => {
      const text = describe(document.activeElement);
      if (text) speak(text, true);
    }, 40);
    return;
  }

  if (!voiceReady) initVoice();

  if (!running) return;

  if (e.key === "Escape") {
    running = false;
    show("menu");
    speak("Você voltou ao menu principal.", true);
    return;
  }

  switch (e.key.toLowerCase()) {
    case "w":
    case "arrowup":
      move(0, -1, "Norte");
      break;

    case "s":
    case "arrowdown":
      move(0, 1, "Sul");
      break;

    case "a":
    case "arrowleft":
      move(-1, 0, "Oeste");
      break;

    case "d":
    case "arrowright":
      move(1, 0, "Leste");
      break;

    case "e":
      echo();
      break;

    case "f":
      interact();
      break;

    case "h":
      help();
      break;
  }
});

function show(id) {
  document.querySelectorAll(".screen")
    .forEach(s => s.classList.add("hidden"));

  const screen = $(id);
  screen.classList.remove("hidden");

  const first = screen.querySelector(
    "button, [tabindex]:not([tabindex='-1'])"
  );

  if (first) setTimeout(() => first.focus(), 50);
}

function startGame() {
  resetWorld();
  running = true;
  show("game");

  setTimeout(() => {
    announce(
      "Zona 01 iniciada. Você está no canto superior esquerdo. " +
      "A saída está em algum lugar do mapa. " +
      "Use E para emitir um eco."
    );
  }, 100);
}

function announce(text) {
  $("gameLog").textContent = text;
  speak(text, true);
}

function isWalkable(x, y) {
  return map[y] && map[y][x] === ".";
}

function move(dx, dy, dirName) {
  const nx = player.x + dx;
  const ny = player.y + dy;

  player.dir = directions.indexOf(dirName);

  if (!isWalkable(nx, ny)) {
    announce(
      `Parede na direção ${dirName}. Você não pode passar.`
    );
    beep(110, 0.16);
    return;
  }

  player.x = nx;
  player.y = ny;

  beep(420, 0.07);

  if (player.x === exit.x && player.y === exit.y) {
    running = false;
    show("win");
    speak(
      "Saída encontrada. Parabéns! Você venceu.",
      true
    );
    return;
  }

  updateHUD();
  draw();

  moveMonster();

  if (!running) return;

  checkThreat();

  const dist = manhattan(player, exit);

  announce(
    `Você está em ${player.x}, ${player.y}. ` +
    `Direção ${dirName}. ` +
    `A saída está a aproximadamente ${dist} passos.`
  );
}

function moveMonster() {
  monster.step++;

  // A criatura se movimenta a cada 2 movimentos do jogador.
  if (monster.step % 2 !== 0) return;

  const options = [
    [1,0], [-1,0], [0,1], [0,-1]
  ];

  options.sort((a,b) => {
    const da = Math.abs((monster.x+a[0])-player.x) +
               Math.abs((monster.y+a[1])-player.y);
    const db = Math.abs((monster.x+b[0])-player.x) +
               Math.abs((monster.y+b[1])-player.y);
    return da - db;
  });

  for (const [dx,dy] of options) {
    const nx = monster.x + dx;
    const ny = monster.y + dy;

    if (isWalkable(nx,ny)) {
      monster.x = nx;
      monster.y = ny;
      break;
    }
  }

  draw();
}

function checkThreat() {
  const dist = manhattan(player, monster);

  if (dist === 0) {
    player.health -= 35;
    $("health").textContent = player.health;
    beep(90, 0.3);

    if (player.health <= 0) {
      running = false;
      show("lose");
      speak(
        "A criatura alcançou você. Sua vida chegou a zero.",
        true
      );
      return;
    }

    announce(
      "A criatura atacou você. " +
      `Vida restante: ${player.health} por cento.`
    );
  } else if (dist <= 2) {
    $("threat").textContent = "muito próxima";
  } else if (dist <= 4) {
    $("threat").textContent = "próxima";
  } else {
    $("threat").textContent = "distante";
  }
}

function echo() {
  const exitDist = manhattan(player, exit);
  const monsterDist = manhattan(player, monster);

  let text;

  if (exitDist <= 2)
    text = "Eco forte e aberto. A saída está muito próxima.";
  else if (exitDist <= 5)
    text = "Eco médio. A saída está a uma distância moderada.";
  else
    text = "Eco fraco. A saída está distante.";

  if (monsterDist <= 2) {
    text += " ALERTA. A criatura está muito próxima.";
    beep(160, 0.15);
    setTimeout(() => beep(90, 0.15), 170);
  } else if (monsterDist <= 4) {
    text += " Você percebe sons de uma criatura próxima.";
  } else {
    text += " Nenhuma ameaça próxima foi detectada.";
  }

  const walls = countWallsAround();
  text += ` Existem ${walls} paredes imediatamente ao redor.`;

  announce(text);
  echoVisual();
}

function countWallsAround() {
  let count = 0;

  for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    if (!isWalkable(player.x+dx, player.y+dy))
      count++;
  }

  return count;
}

function interact() {
  const dist = manhattan(player, exit);

  if (dist <= 1) {
    announce(
      "Você está diante da saída. " +
      "Pressione F novamente para abrir a porta."
    );

    if (player.x === exit.x && player.y === exit.y) {
      running = false;
      show("win");
    }
  } else {
    announce(
      "Você não encontrou nada para interagir aqui."
    );
  }
}

function help() {
  speak(
    "Ajuda. W, S, A e D movimentam o personagem. " +
    "As setas também movimentam. " +
    "E usa o eco. F interage. H repete a ajuda. " +
    "Escape volta ao menu. " +
    "Tab lê os elementos da interface.",
    true
  );
}

function manhattan(a,b) {
  return Math.abs(a.x-b.x) + Math.abs(a.y-b.y);
}

function beep(freq, duration) {
  try {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    const ac = new AudioContext();
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.frequency.value = freq;
    gain.gain.value = 0.07;

    osc.connect(gain);
    gain.connect(ac.destination);

    osc.start();

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ac.currentTime + duration
    );

    osc.stop(ac.currentTime + duration);
  } catch {}
}

function echoVisual() {
  let radius = 20;
  const start = performance.now();

  function animate(now) {
    draw();

    const progress = Math.min(
      (now-start)/800,
      1
    );

    radius = 20 + progress*220;

    ctx.save();
    ctx.globalAlpha = 1-progress;
    ctx.strokeStyle = "#b9dcf7";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.arc(
      player.x*TILE+TILE/2,
      player.y*TILE+TILE/2,
      radius,
      0,
      Math.PI*2
    );
    ctx.stroke();
    ctx.restore();

    if (progress < 1)
      requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // chão e paredes
  for (let y=0; y<map.length; y++) {
    for (let x=0; x<map[y].length; x++) {
      const wall = map[y][x] === "#";

      ctx.fillStyle = wall
        ? "#111a23"
        : "#26333d";

      ctx.fillRect(
        x*TILE,
        y*TILE,
        TILE,
        TILE
      );

      ctx.strokeStyle = "#526879";
      ctx.strokeRect(
        x*TILE,
        y*TILE,
        TILE,
        TILE
      );
    }
  }

  // saída
  ctx.fillStyle = "#38d66b";
  ctx.fillRect(
    exit.x*TILE+8,
    exit.y*TILE+8,
    TILE-16,
    TILE-16
  );

  // criatura
  ctx.fillStyle = "#ed4b4b";
  ctx.beginPath();
  ctx.arc(
    monster.x*TILE+TILE/2,
    monster.y*TILE+TILE/2,
    15,
    0,
    Math.PI*2
  );
  ctx.fill();

  // jogador
  ctx.fillStyle = "#65b7ff";
  ctx.beginPath();
  ctx.arc(
    player.x*TILE+TILE/2,
    player.y*TILE+TILE/2,
    16,
    0,
    Math.PI*2
  );
  ctx.fill();

  // direção
  const arrows = [
    [0,-22],
    [22,0],
    [0,22],
    [-22,0]
  ];

  const [ax,ay] = arrows[player.dir];

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(
    player.x*TILE+TILE/2,
    player.y*TILE+TILE/2
  );
  ctx.lineTo(
    player.x*TILE+TILE/2+ax,
    player.y*TILE+TILE/2+ay
  );
  ctx.stroke();
}

function updateHUD() {
  $("health").textContent = player.health;
  $("direction").textContent = directions[player.dir];
  $("position").textContent = `${player.x}, ${player.y}`;
  $("exitDistance").textContent =
    manhattan(player, exit) + " passos";
}

$("startBtn").onclick = startGame;

$("howBtn").onclick = () => {
  show("how");
  speak(
    "Como jogar. Use Tab para ouvir todos os elementos desta tela.",
    true
  );
};

$("aboutBtn").onclick = () => {
  show("about");
  speak(
    "Acessibilidade. A narração é obrigatória. " +
    "Use Tab para navegar e ouvir os elementos.",
    true
  );
};

$("backHowBtn").onclick = () => show("menu");
$("backAboutBtn").onclick = () => show("menu");

$("gameMenuBtn").onclick = () => {
  running = false;
  show("menu");
  speak("Você voltou ao menu.", true);
};

$("againBtn").onclick = startGame;
$("retryBtn").onclick = startGame;

$("winMenuBtn").onclick = () => show("menu");
$("loseMenuBtn").onclick = () => show("menu");

document.querySelectorAll("[data-action]").forEach(btn => {
  btn.onclick = () => {
    if (!running) return;

    const action = btn.dataset.action;

    if (action === "up") move(0,-1,"Norte");
    if (action === "down") move(0,1,"Sul");
    if (action === "left") move(-1,0,"Oeste");
    if (action === "right") move(1,0,"Leste");
    if (action === "echo") echo();
    if (action === "interact") interact();
    if (action === "help") help();
  };
});

window.addEventListener("load", () => {
  resetWorld();

  setTimeout(() => {
    const first = $("startBtn");
    first.focus();

    /*
      O navegador não permite forçar speechSynthesis
      sem interação. O primeiro TAB ou clique inicializa.
    */
    if (!voiceReady) {
      document.addEventListener(
        "keydown",
        () => {
          if (!voiceReady) initVoice();
        },
        { once: true }
      );
    }
  }, 200);
});
