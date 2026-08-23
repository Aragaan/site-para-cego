(() => {
"use strict";

/* ==========================================================
   ECHO//NULL 2D
   Audio Game RPG acessível
   ========================================================== */

const $ = (selector) => document.querySelector(selector);

const canvas = $("#gameCanvas");
const ctx = canvas.getContext("2d");
const eventText = $("#eventText");
const liveRegion = $("#liveRegion");
const narrationState = $("#narrationState");
const startAudioBtn = $("#startAudioBtn");
const micBtn = $("#micBtn");

const hud = {
  zone: $("#hudZone"),
  hp: $("#hudHp"),
  shield: $("#hudShield"),
  knowledge: $("#hudKnowledge"),
  knowledgeLong: $("#hudKnowledgeLong"),
  direction: $("#hudDirection"),
  position: $("#hudPosition"),
  distance: $("#hudDistance"),
  mic: $("#hudMic")
};

const DIRS = [
  { name: "Norte", dx: 0, dy: -1 },
  { name: "Leste", dx: 1, dy: 0 },
  { name: "Sul", dx: 0, dy: 1 },
  { name: "Oeste", dx: -1, dy: 0 }
];

const zones = [
  { id: 1, name: "Zona 01 — Sinal Inicial", size: 7, seed: 1731 },
  { id: 2, name: "Zona 02 — Ruído Profundo", size: 10, seed: 2847 },
  { id: 3, name: "Zona 03 — Horizonte Sintético", size: 12, seed: 3961 }
];

const checkpointTexts = [
  "Você encontrou o primeiro ponto de conhecimento! Sabia que a Inteligência Artificial consegue entender o espaço ao nosso redor? Assim como o 'eco' que você está usando neste labirinto, a IA em óculos inteligentes e bengalas biônicas usa sensores de profundidade para calcular distâncias. Ela avisa sobre obstáculos no caminho, criando um 'mapa mental' em áudio que dá muito mais segurança para quem não enxerga.",
  "Segundo ponto alcançado! Hoje, a ciência transformou as câmeras dos celulares em olhos inteligentes. Graças à 'Visão Computacional', a IA consegue identificar objetos e ler textos em tempo real. Isso significa que um aplicativo pode ler o cardápio de um restaurante, identificar a cor de uma roupa ou até mesmo descrever o rosto e a expressão de um amigo, traduzindo o mundo visual em palavras.",
  "Terceiro ponto! A mesma tecnologia que faz os carros autônomos andarem sozinhos está mudando a acessibilidade. Aplicativos de navegação guiados por IA usam GPS de alta precisão e processamento de dados em tempo real para guiar pessoas com deficiência visual pelas ruas das cidades. Eles avisam sobre cruzamentos, semáforos e pontos de ônibus, devolvendo a independência de ir e vir."
];

const victoryText =
  "Parabéns, você encontrou a saída! Como você sentiu neste labirinto, a ciência, a tecnologia e a IA não apenas 'melhoram a visão', mas criam novas formas de enxergar o mundo através do som e do tato. O desenvolvimento contínuo de leitores de tela e recursos assistivos é o que garante que todos tenham autonomia, independência e acesso igualitário à informação e à sociedade.";

const assistiveExact =
  "Recursos Assistivos - Acessibilidade integrada. SpeechSynthesis: narração do estado do jogo, colisões, checkpoints e vitória. Web Speech API: comandos de voz em português quando suportados pelo navegador. Web Audio API: ecos com posicionamento estéreo e farol sonoro. ARIA: landmarks, labels, live regions, foco e semântica para leitores de tela. Alto contraste: interface preta com texto claro e indicadores em neon. Baixa visão: mapa ampliado, símbolos, legenda e estado textual. O reconhecimento de voz depende do suporte do navegador e das permissões do microfone. A experiência principal permanece jogável pelo teclado.";

let audio = null;
let voice = null;
let state = null;
let gameLoopId = null;
let lastFrame = performance.now();
let lastBeacon = 0;
let lastEnemyTick = 0;
let paused = false;
let finished = false;
let checkpointPause = false;
let transitionLock = false;

const AudioEngine = {
  ctx: null,
  master: null,
  beaconGain: null,
  beaconOsc: null,
  ready: false,

  async init() {
    if (this.ready) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      setEvent("Web Audio API não é suportada neste navegador.");
      return;
    }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);

    this.beaconGain = this.ctx.createGain();
    this.beaconGain.gain.value = 0;
    this.beaconGain.connect(this.master);

    this.beaconOsc = this.ctx.createOscillator();
    this.beaconOsc.type = "sine";
    this.beaconOsc.frequency.value = 520;
    this.beaconOsc.connect(this.beaconGain);
    this.beaconOsc.start();

    this.ready = true;
    if (this.ctx.state === "suspended") await this.ctx.resume();
    startAudioBtn.textContent = "Áudio ativo";
    speak("Áudio ativado. ECHO NULL pronto.");
  },

  tone({ freq = 440, duration = 0.12, gain = 0.12, pan = 0, type = "sine", attack = 0.01 }) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const p = this.ctx.createStereoPanner();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    p.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(Math.max(.0001, gain), now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g).connect(p).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  },

  step() {
    this.tone({ freq: 115, duration: .055, gain: .07, type: "triangle" });
  },

  wall() {
    this.tone({ freq: 72, duration: .22, gain: .24, type: "sawtooth", pan: 0 });
    this.tone({ freq: 48, duration: .32, gain: .16, type: "square", pan: 0 });
  },

  enemy() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const g = this.ctx.createGain();
    const p = this.ctx.createStereoPanner();
    osc.type = "sawtooth";
    osc.frequency.value = 80;
    lfo.frequency.value = 7;
    lfoGain.gain.value = 26;
    lfo.connect(lfoGain).connect(osc.frequency);
    p.pan.value = 0;
    g.gain.setValueAtTime(.0001, now);
    g.gain.exponentialRampToValueAtTime(.055, now + .02);
    g.gain.exponentialRampToValueAtTime(.0001, now + .28);
    osc.connect(g).connect(p).connect(this.master);
    lfo.start(now); osc.start(now);
    lfo.stop(now + .3); osc.stop(now + .3);
  },

  echo() {
    if (!this.ready || !state) return;
    const p = this.measureWalls();
    const pairs = [
      { d: p.left, pan: -1 },
      { d: p.right, pan: 1 },
      { d: p.front, pan: 0 }
    ];
    pairs.forEach((item, i) => {
      const normalized = Math.min(item.d, 8);
      const freq = 250 + normalized * 125;
      const gain = Math.max(.045, .22 - normalized * .018);
      const pan = item.pan;
      this.tone({
        freq,
        duration: .15 + normalized * .012,
        gain,
        pan,
        type: i === 2 ? "sine" : "triangle"
      });
    });
    this.tone({ freq: 600 + Math.min(p.front, 8) * 80, duration: .08, gain: .08, pan: 0 });
  },

  knowledge() {
    if (!this.ready) return;
    [440, 554, 659, 880].forEach((f, i) => {
      setTimeout(() => this.tone({ freq: f, duration: .22, gain: .09, pan: (i - 1.5) / 2 }), i * 100);
    });
  },

  secret() {
    if (!this.ready) return;
    [330, 495, 660, 990, 1320].forEach((f, i) => {
      setTimeout(() => this.tone({ freq: f, duration: .16, gain: .08, pan: i % 2 ? .55 : -.55, type: "square" }), i * 80);
    });
  },

  victory() {
    if (!this.ready) return;
    [392, 523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.tone({ freq: f, duration: .45, gain: .12, pan: (i - 2) / 2 }), i * 150);
    });
  },

  shield() {
    this.tone({ freq: 920, duration: .16, gain: .1, type: "sine" });
    this.tone({ freq: 1200, duration: .2, gain: .07, pan: 0, type: "triangle" });
  },

  updateBeacon() {
    if (!this.ready || !state || finished) return;
    const dist = manhattan(state.player.x, state.player.y, state.exit.x, state.exit.y);
    const dx = state.exit.x - state.player.x;
    const dy = state.exit.y - state.player.y;
    const angle = Math.atan2(dy, dx);
    const pan = Math.max(-1, Math.min(1, Math.sin(angle)));
    const freq = 340 + Math.max(0, 20 - dist) * 18;
    const gain = Math.max(.018, Math.min(.13, .14 - dist * .006));
    const now = this.ctx.currentTime;
    this.beaconOsc.frequency.setTargetAtTime(freq, now, .035);
    this.beaconGain.gain.setTargetAtTime(gain, now, .08);
    this.beaconGain._pan = pan;
    if (!this.beaconPanner) {
      this.beaconPanner = this.ctx.createStereoPanner();
      this.beaconGain.disconnect();
      this.beaconGain.connect(this.beaconPanner).connect(this.master);
    }
    this.beaconPanner.pan.setTargetAtTime(pan, now, .06);
  },

  measureWalls() {
    if (!state) return { front: 1, left: 1, right: 1, back: 1 };
    const dirs = {
      front: state.dir,
      right: (state.dir + 1) % 4,
      back: (state.dir + 2) % 4,
      left: (state.dir + 3) % 4
    };
    const result = {};
    for (const [key, dir] of Object.entries(dirs)) {
      let x = state.player.x;
      let y = state.player.y;
      let d = 0;
      while (d < 8) {
        x += DIRS[dir].dx;
        y += DIRS[dir].dy;
        if (!isWalkable(x, y)) break;
        d++;
      }
      result[key] = d;
    }
    return result;
  }
};

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeMaze(size, seed) {
  const random = rng(seed);
  const grid = Array.from({ length: size }, () => Array(size).fill("#"));

  // Prim-like randomized growth starting from (1,1), with an accessible outer border.
  const start = { x: 1, y: 1 };
  grid[start.y][start.x] = ".";
  const frontier = [];
  const addFrontier = (x, y) => {
    for (const d of [[2,0],[-2,0],[0,2],[0,-2]]) {
      const nx = x + d[0], ny = y + d[1];
      if (nx > 0 && ny > 0 && nx < size - 1 && ny < size - 1 && grid[ny][nx] === "#") {
        frontier.push({ x: nx, y: ny, px: x, py: y });
      }
    }
  };
  addFrontier(1, 1);

  while (frontier.length) {
    const i = Math.floor(random() * frontier.length);
    const f = frontier.splice(i, 1)[0];
    if (grid[f.y][f.x] !== "#") continue;
    grid[f.y][f.x] = ".";
    grid[(f.y + f.py) >> 1][(f.x + f.px) >> 1] = ".";
    addFrontier(f.x, f.y);
  }

  // Open the entrance and create a guaranteed corridor along the border.
  grid[1][0] = ".";
  grid[1][1] = ".";
  grid[size - 2][size - 1] = ".";
  grid[size - 2][size - 2] = ".";

  // Ensure enough open cells for checkpoints and enemies.
  const open = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (grid[y][x] === ".") open.push({x,y});
  }

  return grid;
}

function farthestCell(grid, start) {
  const q = [start];
  const dist = new Map([[key(start.x,start.y), 0]]);
  let far = start;
  while (q.length) {
    const cur = q.shift();
    const d = dist.get(key(cur.x, cur.y));
    if (d > dist.get(key(far.x, far.y))) far = cur;
    for (const n of neighbors(cur.x, cur.y, grid)) {
      const k = key(n.x,n.y);
      if (!dist.has(k)) {
        dist.set(k, d + 1);
        q.push(n);
      }
    }
  }
  return far;
}

function key(x,y) { return `${x},${y}`; }

function neighbors(x, y, grid) {
  return DIRS.map(d => ({x:x+d.dx, y:y+d.dy}))
    .filter(p => p.y >= 0 && p.y < grid.length && p.x >= 0 && p.x < grid.length && grid[p.y][p.x] === ".");
}

function isWalkable(x, y) {
  return !!state && y >= 0 && y < state.grid.length && x >= 0 && x < state.grid.length && state.grid[y][x] === ".";
}

function manhattan(x1,y1,x2,y2) { return Math.abs(x1-x2) + Math.abs(y1-y2); }

function chooseSpecialCells(grid, start, exit, count, randomSeed) {
  const random = rng(randomSeed);
  const candidates = [];
  for (let y=1; y<grid.length-1; y++) for (let x=1; x<grid.length-1; x++) {
    if (grid[y][x] === "." && manhattan(x,y,start.x,start.y) > 3 && manhattan(x,y,exit.x,exit.y) > 2) {
      candidates.push({x,y});
    }
  }
  candidates.sort(() => random() - .5);
  const chosen = [];
  for (const c of candidates) {
    if (chosen.every(p => manhattan(p.x,p.y,c.x,c.y) >= 3)) {
      chosen.push(c);
      if (chosen.length >= count) break;
    }
  }
  return chosen;
}

function buildZone(zoneIndex) {
  const z = zones[zoneIndex];
  const grid = makeMaze(z.size, z.seed);
  const start = { x: 1, y: 1 };
  const exit = farthestCell(grid, {x:z.size-2, y:z.size-2});
  // Put the exit near the opposite side while preserving reachability.
  const checkpoints = chooseSpecialCells(grid, start, exit, 3, z.seed + 77);
  const enemyCells = chooseSpecialCells(grid, start, exit, Math.min(3, zoneIndex + 2), z.seed + 144);

  return {
    ...z,
    grid,
    start,
    exit,
    checkpoints: checkpoints.map((p,i) => ({...p, id:i+1, reached:false})),
    enemies: enemyCells.map((p,i) => ({...p, id:i+1, alive:true, phase:i * 1.7})),
    secrets: [
      {x: 0, y: 1, triggered:false},
      {x: z.size - 1, y: z.size - 2, triggered:false}
    ]
  };
}

function resetZone(index) {
  const zone = buildZone(index);
  state = {
    zoneIndex: index,
    grid: zone.grid,
    zone,
    player: {...zone.start},
    dir: 0,
    hp: 100,
    shield: false,
    knowledge: 0,
    checkpoints: 0,
    exit: zone.exit,
    enemyPulse: 0,
    score: 0,
    secrets: 0
  };
  finished = false;
  checkpointPause = false;
  transitionLock = false;
  setEvent(`${zone.name}. Você está na entrada. O farol aguarda.`);
  speak(`${zone.name}. Você está na entrada. Pressione Espaço para emitir um eco.`);
  AudioEngine.updateBeacon();
  updateHUD();
  draw();
}

function startGame() {
  resetZone(0);
  if (!gameLoopId) gameLoopId = requestAnimationFrame(loop);
}

function loop(now) {
  const dt = now - lastFrame;
  lastFrame = now;

  if (state && !paused && !checkpointPause && !finished) {
    if (now - lastEnemyTick > 950) {
      moveEnemies();
      lastEnemyTick = now;
    }
    if (now - lastBeacon > 90) {
      AudioEngine.updateBeacon();
      lastBeacon = now;
    }
    draw(now);
  }
  gameLoopId = requestAnimationFrame(loop);
}

function setEvent(text) {
  eventText.textContent = text;
  liveRegion.textContent = "";
  requestAnimationFrame(() => { liveRegion.textContent = text; });
}

function speak(text, {interrupt=true}={}) {
  if (!("speechSynthesis" in window)) return;
  if (interrupt) window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "pt-BR";
  u.rate = .95;
  u.pitch = 1;
  u.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  u.voice = voices.find(v => /^pt-BR$/i.test(v.lang)) ||
            voices.find(v => /^pt/i.test(v.lang)) || null;
  window.speechSynthesis.speak(u);
  narrationState.textContent = `Falando: ${text}`;
}

function updateHUD() {
  if (!state) return;
  hud.zone.textContent = String(state.zoneIndex + 1).padStart(2,"0");
  hud.hp.textContent = String(state.hp);
  hud.shield.textContent = state.shield ? "ATIVO" : "PRONTO";
  hud.knowledge.textContent = `${state.knowledge}/3`;
  hud.knowledgeLong.textContent = `${state.knowledge}/3`;
  hud.direction.textContent = DIRS[state.dir].name;
  hud.position.textContent = `${state.player.x}, ${state.player.y}`;
  hud.distance.textContent = String(manhattan(state.player.x,state.player.y,state.exit.x,state.exit.y));
}

function relativeMovementText(kind) {
  return {
    forward: "Você avançou reto.",
    back: "Você deu um passo para trás.",
    left: "Você virou para a esquerda.",
    right: "Você virou para a direita."
  }[kind];
}

function move(kind) {
  if (!state || paused || checkpointPause || finished || transitionLock) return;
  if (kind === "left") {
    state.dir = (state.dir + 3) % 4;
    AudioEngine.tone({freq:260,duration:.08,gain:.07,pan:-.65});
    setEvent(relativeMovementText(kind));
    speak(relativeMovementText(kind));
    checkSecret();
    updateHUD();
    return;
  }
  if (kind === "right") {
    state.dir = (state.dir + 1) % 4;
    AudioEngine.tone({freq:420,duration:.08,gain:.07,pan:.65});
    setEvent(relativeMovementText(kind));
    speak(relativeMovementText(kind));
    checkSecret();
    updateHUD();
    return;
  }

  const direction = kind === "back" ? (state.dir + 2) % 4 : state.dir;
  const nx = state.player.x + DIRS[direction].dx;
  const ny = state.player.y + DIRS[direction].dy;

  if (!isWalkable(nx,ny)) {
    if (state.shield) {
      state.shield = false;
      AudioEngine.shield();
      setEvent("O Escudo Sonoro absorveu o impacto.");
      speak("O Escudo Sonoro absorveu o impacto.");
    } else {
      AudioEngine.wall();
      setEvent("Existe uma parede que você não consegue passar.");
      speak("Existe uma parede que você não consegue passar.");
      state.hp = Math.max(0, state.hp - 2);
      if (state.hp === 0) {
        state.hp = 100;
        state.player = {...state.zone.start};
        speak("Sua estrutura chegou a zero. Você retornou à entrada.");
      }
    }
    updateHUD();
    return;
  }

  state.player.x = nx;
  state.player.y = ny;
  AudioEngine.step();
  const text = relativeMovementText(kind);
  setEvent(text);
  speak(text, {interrupt:false});

  checkSecret();
  checkCheckpoint();
  checkEnemyCollision();
  checkExit();
  updateHUD();
  AudioEngine.updateBeacon();
}

function checkCheckpoint() {
  const cp = state.zone.checkpoints.find(c => c.x === state.player.x && c.y === state.player.y && !c.reached);
  if (!cp) return;
  cp.reached = true;
  state.checkpoints++;
  state.knowledge++;
  checkpointPause = true;
  AudioEngine.knowledge();
  setEvent(`Ponto de conhecimento ${cp.id} encontrado.`);
  speak(`Ponto de conhecimento ${cp.id}. ${checkpointTexts[cp.id - 1]}`);
  setTimeout(() => {
    if (finished) return;
    checkpointPause = false;
    speak("Checkpoint concluído. Você pode continuar.");
    setEvent("Checkpoint concluído. Você pode continuar.");
  }, Math.max(4200, checkpointTexts[cp.id-1].length * 42));
}

function checkEnemyCollision() {
  const enemy = state.zone.enemies.find(e => e.alive && e.x === state.player.x && e.y === state.player.y);
  if (!enemy) return;
  if (state.shield) {
    state.shield = false;
    enemy.alive = false;
    AudioEngine.shield();
    setEvent("O Escudo Sonoro anulou uma Entidade de Ruído.");
    speak("O Escudo Sonoro anulou uma Entidade de Ruído.");
    return;
  }
  AudioEngine.enemy();
  state.hp = Math.max(1, state.hp - 25);
  const cp = [...state.zone.checkpoints].reverse().find(c => c.reached);
  state.player = cp ? {x:cp.x,y:cp.y} : {...state.zone.start};
  setEvent("Uma Entidade de Ruído atingiu você. Você voltou ao último checkpoint.");
  speak("Uma Entidade de Ruído atingiu você. Você perdeu estrutura e retornou ao último checkpoint.");
}

function checkSecret() {
  const secret = state.zone.secrets.find(s => s.x === state.player.x && s.y === state.player.y && !s.triggered);
  if (!secret) return;
  secret.triggered = true;
  state.secrets++;
  AudioEngine.secret();
  const text = "Sala secreta descoberta! Este sinal representa a história dos recursos assistivos: tecnologias de áudio, leitores de tela e jogos sonoros mostram que acessibilidade também pode ser uma forma criativa de interação.";
  setEvent(text);
  speak(text);
}

function checkExit() {
  if (state.player.x !== state.exit.x || state.player.y !== state.exit.y) return;
  transitionLock = true;
  if (state.checkpoints < 3) {
    setEvent(`O farol está aqui, mas faltam ${3-state.checkpoints} pontos de conhecimento.`);
    speak(`Você encontrou o farol, mas ainda precisa visitar ${3-state.checkpoints} pontos de conhecimento.`);
    setTimeout(() => transitionLock = false, 500);
    return;
  }
  AudioEngine.victory();
  finished = true;
  setEvent(victoryText);
  speak(victoryText);
  setTimeout(() => {
    if (state.zoneIndex < zones.length - 1) {
      const next = state.zoneIndex + 1;
      speak(`Zona concluída. Preparando ${zones[next].name}.`);
      resetZone(next);
    } else {
      setEvent("Você concluiu todas as três zonas. ECHO NULL finalizado.");
      speak("Você concluiu todas as três zonas. ECHO NULL finalizado. Parabéns, Explorador.");
    }
  }, 6500);
}

function superEcho() {
  if (!state || paused || checkpointPause || finished) return;
  AudioEngine.echo();
  const exitDist = manhattan(state.player.x,state.player.y,state.exit.x,state.exit.y);
  const enemies = state.zone.enemies
    .filter(e => e.alive)
    .map(e => manhattan(state.player.x,state.player.y,e.x,e.y));
  const nearest = enemies.length ? Math.min(...enemies) : null;
  const walls = AudioEngine.measureWalls();
  const msg = `Super Eco. Farol a ${exitDist} passos. ${nearest === null ? "Nenhuma entidade detectada." : `Entidade mais próxima a ${nearest} passos.`} Parede à frente a ${walls.front} passos, à esquerda a ${walls.left}, à direita a ${walls.right}.`;
  setEvent(msg);
  speak(msg);
}

function useShield() {
  if (!state || paused || checkpointPause || finished) return;
  state.shield = true;
  AudioEngine.shield();
  setEvent("Escudo Sonoro ativado. O próximo impacto será anulado.");
  speak("Escudo Sonoro ativado. O próximo impacto será anulado.");
  updateHUD();
}

function echo() {
  if (!state || paused || checkpointPause || finished) return;
  AudioEngine.echo();
  const w = AudioEngine.measureWalls();
  const msg = `Eco emitido. À frente, ${w.front} passos livres. À esquerda, ${w.left}. À direita, ${w.right}.`;
  setEvent(msg);
  speak(msg);
}

function stateReport() {
  if (!state) return;
  const dist = manhattan(state.player.x,state.player.y,state.exit.x,state.exit.y);
  const text = `Estado atual. ${zones[state.zoneIndex].name}. Você está em ${state.player.x}, ${state.player.y}, olhando para ${DIRS[state.dir].name}. O farol está a ${dist} passos. Conhecimento ${state.knowledge} de 3. Estrutura ${state.hp}.`;
  setEvent(text);
  speak(text);
}

function togglePause() {
  if (finished || checkpointPause) return;
  paused = !paused;
  const text = paused ? "Jogo pausado." : "Jogo retomado.";
  setEvent(text);
  speak(text);
}

function draw(now=performance.now()) {
  if (!state) return;
  const size = state.grid.length;
  const cell = Math.min(canvas.width, canvas.height) / size;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = "#020304";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // Grid.
  for (let y=0;y<size;y++) {
    for (let x=0;x<size;x++) {
      const px=x*cell, py=y*cell;
      if (state.grid[y][x] === "#") {
        ctx.fillStyle="#111822";
        ctx.fillRect(px,py,cell,cell);
        ctx.strokeStyle="rgba(0,240,255,.35)";
        ctx.strokeRect(px+.5,py+.5,cell-1,cell-1);
      } else {
        ctx.fillStyle="#05090e";
        ctx.fillRect(px,py,cell,cell);
        ctx.strokeStyle="rgba(255,255,255,.055)";
        ctx.strokeRect(px+.5,py+.5,cell-1,cell-1);
      }
    }
  }

  // Checkpoints.
  state.zone.checkpoints.forEach(cp => {
    if (cp.reached) return;
    const cx=(cp.x+.5)*cell, cy=(cp.y+.5)*cell;
    ctx.beginPath(); ctx.arc(cx,cy,cell*.25,0,Math.PI*2);
    ctx.strokeStyle="#ff9d00"; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle="#ff9d00"; ctx.font=`bold ${Math.max(12,cell*.3)}px sans-serif`;
    ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(cp.id,cx,cy);
  });

  // Exit star.
  const ex=(state.exit.x+.5)*cell, ey=(state.exit.y+.5)*cell;
  drawStar(ex,ey,cell*.3,cell*.13,5,"#43ff9a");

  // Enemies.
  state.zone.enemies.forEach(e => {
    if (!e.alive) return;
    const ex2=(e.x+.5)*cell, ey2=(e.y+.5)*cell;
    ctx.save();
    ctx.translate(ex2,ey2);
    ctx.rotate(Math.sin(now/500+e.phase)*.18);
    ctx.beginPath();
    ctx.moveTo(0,-cell*.3); ctx.lineTo(cell*.27,cell*.24); ctx.lineTo(-cell*.27,cell*.24); ctx.closePath();
    ctx.fillStyle="#ff365c"; ctx.fill();
    ctx.restore();
  });

  // Player.
  const px=(state.player.x+.5)*cell, py=(state.player.y+.5)*cell;
  ctx.beginPath(); ctx.arc(px,py,cell*.27,0,Math.PI*2);
  ctx.fillStyle="#00f0ff"; ctx.shadowBlur=18; ctx.shadowColor="#00f0ff"; ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke();

  // Direction line.
  const d=DIRS[state.dir];
  ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px+d.dx*cell*.42,py+d.dy*cell*.42);
  ctx.strokeStyle="#fff"; ctx.lineWidth=4; ctx.stroke();

  // Zone label.
  ctx.fillStyle="rgba(0,0,0,.7)";
  ctx.fillRect(10,10,Math.min(310,canvas.width-20),36);
  ctx.fillStyle="#fff"; ctx.font="bold 16px sans-serif";
  ctx.textAlign="left"; ctx.textBaseline="middle";
  ctx.fillText(`${zones[state.zoneIndex].name} • ${size}×${size}`,20,28);
}

function drawStar(cx,cy,outer,inner,points,color) {
  ctx.save();
  ctx.beginPath();
  for (let i=0;i<points*2;i++) {
    const a=-Math.PI/2+i*Math.PI/points;
    const r=i%2===0?outer:inner;
    const x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.fillStyle=color; ctx.shadowBlur=16; ctx.shadowColor=color; ctx.fill(); ctx.shadowBlur=0;
  ctx.restore();
}

function moveEnemies() {
  if (!state) return;
  state.zone.enemies.forEach((e, idx) => {
    if (!e.alive) return;
    const options = neighbors(e.x,e.y,state.grid).filter(p =>
      !(p.x === state.player.x && p.y === state.player.y)
    );
    if (!options.length) return;
    // Semi-deterministic patrol: every few ticks choose an adjacent cell.
    const target = options[(Math.floor(performance.now()/950)+idx)%options.length];
    e.x = target.x; e.y = target.y;
    const dist = manhattan(e.x,e.y,state.player.x,state.player.y);
    if (dist <= 3) AudioEngine.enemy();
  });
}

function normalizeVoice(text) {
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^\p{L}\p{N}\s]/gu," ");
}

function interpretVoice(raw) {
  const t = normalizeVoice(raw);
  if (/\b(eco|sonar|pulso|ouvir|onde estou)\b/.test(t)) return "echo";
  if (/\b(radar|super eco|especial)\b/.test(t)) return "radar";
  if (/\b(escudo)\b/.test(t)) return "shield";
  if (/\b(frente|avancar|reto|ir|subir|frente reto)\b/.test(t)) return "forward";
  if (/\b(tras|voltar|re|descer|recuar)\b/.test(t)) return "back";
  if (/\b(esquerda|vira esquerda|virei esquerda|lado esquerdo)\b/.test(t)) return "left";
  if (/\b(direita|vira direita|lado direito|virei direita)\b/.test(t)) return "right";
  return null;
}

function setupSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    hud.mic.textContent = "NÃO SUPORTADO";
    return null;
  }
  const rec = new SR();
  rec.lang = "pt-BR";
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 5;

  rec.onstart = () => {
    hud.mic.textContent = "OUVINDO";
    micBtn.setAttribute("aria-pressed","true");
    micBtn.textContent = "Microfone ouvindo…";
  };
  rec.onresult = (event) => {
    const alternatives = Array.from(event.results[0] || []).map(r => r.transcript);
    const command = alternatives.map(interpretVoice).find(Boolean);
    const spoken = alternatives[0] || "";
    if (!command) {
      setEvent(`Não entendi "${spoken}". Tente dizer avançar, esquerda, direita, eco, radar ou escudo.`);
      speak("Não entendi o comando. Tente avançar, esquerda, direita, eco, radar ou escudo.");
      return;
    }
    if (command === "echo") echo();
    else if (command === "radar") superEcho();
    else if (command === "shield") useShield();
    else move(command);
  };
  rec.onerror = (event) => {
    hud.mic.textContent = `ERRO: ${event.error}`;
    setEvent(`Microfone: ${event.error}.`);
  };
  rec.onend = () => {
    hud.mic.textContent = "ATIVO";
    micBtn.setAttribute("aria-pressed","false");
    micBtn.textContent = "Ativar microfone";
  };
  return rec;
}

voice = setupSpeechRecognition();

function toggleMic() {
  if (!voice) {
    speak("Reconhecimento de voz não é suportado neste navegador.");
    return;
  }
  try {
    voice.start();
  } catch {
    try { voice.stop(); } catch {}
  }
}

function handleKey(e) {
  if (e.target.matches("button, input, textarea, select")) return;
  const k = e.key.toLowerCase();
  const controls = {
    ArrowUp:"forward", w:"forward",
    ArrowDown:"back", s:"back",
    ArrowLeft:"left", a:"left",
    ArrowRight:"right", d:"right"
  };
  if (controls[e.key] || controls[k]) {
    e.preventDefault();
    move(controls[e.key] || controls[k]);
    return;
  }
  if (e.code === "Space") { e.preventDefault(); echo(); return; }
  if (k === "r") { e.preventDefault(); superEcho(); return; }
  if (k === "e") { e.preventDefault(); useShield(); return; }
  if (k === "v") { e.preventDefault(); toggleMic(); return; }
  if (k === "p") { e.preventDefault(); togglePause(); return; }
  if (k === "m") { e.preventDefault(); stateReport(); return; }
}

document.addEventListener("keydown", handleKey);

startAudioBtn.addEventListener("click", async () => {
  await AudioEngine.init();
  if (!state) startGame();
});

micBtn.addEventListener("click", toggleMic);

$("#repeatStateBtn").addEventListener("click", stateReport);
document.querySelectorAll("[data-skill]").forEach(btn => {
  btn.addEventListener("click", () => btn.dataset.skill === "radar" ? superEcho() : useShield());
});

document.querySelectorAll("[data-speech]").forEach(el => {
  el.addEventListener("focus", () => {
    const text = el === $("#assistive") ? assistiveExact : el.dataset.speech;
    speak(text);
  });
});

window.speechSynthesis?.addEventListener?.("voiceschanged", () => {});

window.addEventListener("beforeunload", () => {
  try { window.speechSynthesis.cancel(); } catch {}
  if (voice) try { voice.stop(); } catch {}
  if (AudioEngine.ctx) try { AudioEngine.ctx.close(); } catch {}
});

// Canvas click starts audio for browsers requiring a user gesture.
canvas.addEventListener("click", async () => {
  await AudioEngine.init();
  if (!state) startGame();
});

startGame();

})();
