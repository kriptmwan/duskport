// Duskport — main: GameState, fixed-timestep loop, wiring, save/load, shot modes.
import { WORLD, MISSIONS, SHOPS, COOLDOWN_ZONES, WANTED } from './config.js';
import { makeRng } from './random.js';
import { generateWorld, pointSolid, nearestRoadPoint, SHOP_BUILDINGS } from './world.js';
import { createPlayer, updatePlayer, damagePlayer, respawnHospital, respawnArrested, topSpeed, maxCarHp } from './player.js';
import { createCar, makeTrafficCar, makeParkedCar, driveCar, damageCar, updateTraffic, nearestEnterableCar } from './vehicles.js';
import { createWanted, addWanted, ensureCops, updateCops, bulletsVsCops } from './police.js';
import { createMissionState, currentMission, currentStep, objectiveOf, updateMissions, failStep, missionSave, missionLoad } from './missions.js';
import { ensureAudio, playSfx, radioName, toggleRadio, nextStation } from './audio.js';
import { createInput } from './input.js';
import { createCamera, updateCamera, render } from './render.js';
import { drawHUD, drawTitle, drawPause, drawShop, drawEndOverlay, getButtons, clearButtons, showToast, showBanner, clearBanner, tickUi } from './ui.js';

const SAVE_KEY = 'duskport-save-v1';
const STEP = 1 / 60;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(location.search);
const shot = params.get('shot') || null;

const rng = makeRng(WORLD.seed);
const world = generateWorld(rng);

const g = {
  state: 'title', // title | playing | paused | shop | dead | arrested | complete
  time: 0,
  timeOfDay: 30, // seconds into the 240s dusk cycle
  world,
  rng,
  player: null,
  wanted: createWanted(),
  missions: createMissionState(),
  cops: [],
  cars: [],
  bullets: [],
  particles: [],
  events: [],
  cam: createCamera(),
  canvasW: window.innerWidth,
  canvasH: window.innerHeight,
  objective: null,
  radio: radioName(),
  shopTab: 'garage',
  saveExists: false,
  saveMission: 0,
  shootHeatT: 0,
  ambientRobT: 0,
  ambientStore: null,
  lastMissionIndex: 0,
  stats: { evades: 0, robs: 0, copsDown: 0 },
};

function storePositions() {
  return SHOP_BUILDINGS.filter(b => b.label === 'STORE').map(b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 }));
}

function spawnWorld() {
  g.cars = [];
  g.cops = [];
  g.bullets = [];
  g.particles = [];
  // Traffic.
  for (let i = 0; i < 10; i++) g.cars.push(makeTrafficCar(rng, world));
  // Parked cars near roads.
  const spots = [
    [300, 250, 0], [1300, 250, 0], [2300, 250, 0], [300, 650, 0], [1800, 650, 0],
    [2300, 1050, 0], [300, 1450, 0], [1300, 1850, 0], [2800, 1850, 0], [800, 2150, 0],
  ];
  for (const [x, y, a] of spots) g.cars.push(makeParkedCar(rng, x, y, a));
}

function newGame() {
  g.player = createPlayer(1250, 560);
  g.wanted = createWanted();
  g.missions = createMissionState();
  g.lastMissionIndex = 0;
  spawnWorld();
  startChaseIntro();
  g.state = 'playing';
}

function startChaseIntro() {
  // Gate 1 tip: spawn ALREADY in a stolen car, 1 star wanted, mid-chase.
  const car = createCar(1250, 700, Math.PI / 2, '#c0392b', 'player');
  car.hp = maxCarHp(g.player); car.maxHp = car.hp;
  g.cars.push(car);
  g.player.car = car;
  g.player.mode = 'car';
  g.player.x = car.x; g.player.y = car.y;
  addWanted(g.wanted, 1, g.events);
  ensureCops(g.cops, g.wanted, g.player, world, rng);
  // Push the two cops a little closer so the chase reads immediately.
  for (const c of g.cops) {
    if (c.kind === 'car') { c.car.x = g.player.x - 260; c.car.y = g.player.y + 120; }
  }
  showBanner('LOSE THE COPS', 'Break line of sight — then the job starts', 4);
  showToast('Mission 1: Hot Wheels — lose the cops, then reach Mara\u2019s garage');
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    g.saveExists = true;
    g.saveMission = Math.min(s.missionIndex || 0, MISSIONS.length - 1);
    return true;
  } catch (e) { return false; }
}

function continueGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  const s = raw ? JSON.parse(raw) : {};
  g.player = createPlayer(s.x || 1250, s.y || 560);
  g.player.cash = s.cash ?? 150;
  g.player.respect = s.respect ?? 0;
  g.player.engineLevel = s.engineLevel || 0;
  g.player.armorLevel = s.armorLevel || 0;
  if (s.weapons) g.player.weapons = s.weapons;
  g.player.weapon = s.weapon || 'pistol';
  g.wanted = createWanted();
  g.missions = createMissionState();
  missionLoad(g.missions, { index: s.missionIndex || 0, step: s.missionStep || 0 });
  g.lastMissionIndex = g.missions.index;
  spawnWorld();
  g.state = 'playing';
  showToast('Welcome back — Mission ' + (g.missions.index + 1) + ': ' + (currentMission(g.missions)?.name || 'Free roam'));
}

function saveGame() {
  const p = g.player;
  const s = {
    cash: p.cash, respect: p.respect,
    missionIndex: g.missions.index, missionStep: g.missions.step,
    engineLevel: p.engineLevel, armorLevel: p.armorLevel,
    weapons: p.weapons, weapon: p.weapon,
    x: p.x, y: p.y,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
  g.saveExists = true;
  g.saveMission = s.missionIndex;
}

loadSave();

// Shot modes for screenshots (kit shots.json): start = title, play = mid-chase,
// end = mission 8, 4 stars, at the Palms mansion.
if (shot === 'play') {
  newGame();
} else if (shot === 'end') {
  newGame();
  g.missions.index = 7; g.missions.step = 0; g.lastMissionIndex = 7;
  g.player.cash = 4200; g.player.respect = 700;
  // Park the player ~400px from the pickup point so the mission is in
  // progress (spawning inside the objective radius would complete it instantly).
  g.player.x = 1400; g.player.y = 1700;
  if (g.player.car) { g.player.car.x = 1400; g.player.car.y = 1650; g.player.car.angle = -Math.PI / 4; }
  addWanted(g.wanted, 4, g.events);
  ensureCops(g.cops, g.wanted, g.player, world, rng);
  showBanner('THE LAST RUN', 'Pick up the final goods — Industrial', 4);
  showToast('Mission 8: Kingpin\u2019s Call — pick up the final goods');
}

function screenToWorld(sx, sy) {
  return { x: sx + g.cam.x, y: sy + g.cam.y };
}

function handleMenuClick(sx, sy) {
  for (const b of getButtons()) {
    if (!b.enabled) continue;
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) return b.id;
  }
  return null;
}

function buyItem(id) {
  const p = g.player;
  const price = {
    'engine': [0, 600, 1500][p.engineLevel + 1],
    'armor': [0, 700, 1600][p.armorLevel + 1],
    'buy-smg': 800, 'buy-shotgun': 1200, 'ammo-smg': 60, 'ammo-shotgun': 90,
  }[id];
  if (price === undefined || p.cash < price) { playSfx('deny'); return; }
  p.cash -= price;
  if (id === 'engine') { p.engineLevel += 1; if (p.car) { p.car.maxHp = maxCarHp(p); } }
  else if (id === 'armor') { p.armorLevel += 1; if (p.car) { p.car.maxHp = maxCarHp(p); p.car.hp = p.car.maxHp; } }
  else if (id === 'buy-smg') { p.weapons.smg.owned = true; p.weapons.smg.ammo = 60; }
  else if (id === 'buy-shotgun') { p.weapons.shotgun.owned = true; p.weapons.shotgun.ammo = 24; }
  else if (id === 'ammo-smg') { p.weapons.smg.ammo += 60; }
  else if (id === 'ammo-shotgun') { p.weapons.shotgun.ammo += 24; }
  playSfx('buy');
  showToast('Purchased — $' + price);
}

function update(dt) {
  g.time += dt;
  g.timeOfDay = (g.timeOfDay + dt) % 240;
  tickUi(dt);

  if (input.hadGesture()) { ensureAudio(); input.clearGesture(); }

  if (g.state === 'title') {
    if (input.mouse().pressed) {
      const id = handleMenuClick(input.mouse().x, input.mouse().y);
      if (id === 'continue') continueGame();
      else if (id === 'new') newGame();
    }
    return;
  }
  if (g.state === 'paused') {
    if (input.mouse().pressed) {
      const id = handleMenuClick(input.mouse().x, input.mouse().y);
      if (id === 'resume') g.state = 'playing';
      else if (id === 'save') { saveGame(); showToast('Game saved'); }
      else if (id === 'restart') { newGame(); }
      else if (id === 'quit') { g.state = 'title'; loadSave(); }
    }
    if (input.wasPressed('p') || input.wasPressed('Escape')) g.state = 'playing';
    return;
  }
  if (g.state === 'shop') {
    if (input.mouse().pressed) {
      const id = handleMenuClick(input.mouse().x, input.mouse().y);
      if (id === 'tab-garage') g.shopTab = 'garage';
      else if (id === 'tab-guns') g.shopTab = 'guns';
      else if (id === 'shop-close') g.state = 'playing';
      else if (id) buyItem(id);
    }
    if (input.wasPressed('e') || input.wasPressed('Escape')) g.state = 'playing';
    return;
  }
  if (g.state === 'dead' || g.state === 'arrested') {
    if (input.mouse().pressed) {
      const id = handleMenuClick(input.mouse().x, input.mouse().y);
      if (id === 'respawn') {
        if (g.state === 'dead') respawnHospital(g.player, world);
        else respawnArrested(g.player);
        g.wanted = createWanted();
        g.cops = [];
        g.state = 'playing';
      }
    }
    return;
  }
  if (g.state === 'complete') {
    if (input.mouse().pressed) {
      const id = handleMenuClick(input.mouse().x, input.mouse().y);
      if (id === 'freeroam') g.state = 'playing';
      else if (id === 'title') { g.state = 'title'; loadSave(); }
    }
    return;
  }

  // ---- playing ----
  const p = g.player;
  const m = input.mouse();
  const mouseWorld = screenToWorld(m.x, m.y);

  // Pause / radio.
  if (input.wasPressed('p') || input.wasPressed('Escape')) { g.state = 'paused'; return; }
  if (input.wasPressed('r')) { g.radio = nextStation(); showToast('Radio: ' + g.radio); }
  if (input.wasPressed('m')) showToast('Minimap is always on — top right');

  // Enter / exit car, shops.
  if (input.wasPressed('e')) {
    if (p.mode === 'foot') {
      const car = nearestEnterableCar(g.cars, p.x, p.y, 70);
      if (car) {
        // Stealing seen by a cop = +1 star.
        const seen = g.cops.some(c => Math.hypot(c.x - p.x, c.y - p.y) < 500);
        car.kind = 'player';
        car.hp = Math.max(car.hp, 1);
        car.maxHp = Math.max(car.maxHp, maxCarHp(p));
        p.car = car;
        p.mode = 'car';
        p.x = car.x; p.y = car.y;
        if (seen) addWanted(g.wanted, 1, g.events);
        playSfx('objective');
      } else {
        // Near a shop? Open it.
        if (nearShop(p, SHOPS.garage)) { g.state = 'shop'; g.shopTab = 'garage'; }
        else if (nearShop(p, SHOPS.gunshop)) { g.state = 'shop'; g.shopTab = 'guns'; }
      }
    } else if (p.mode === 'car' && p.car) {
      const car = p.car;
      const a = car.angle + Math.PI / 2;
      p.x = car.x + Math.cos(a) * 30;
      p.y = car.y + Math.sin(a) * 30;
      p.mode = 'foot';
      p.car = null;
    }
  }

  // Movement: foot or car.
  if (p.mode === 'foot') {
    updatePlayer(p, dt, input, world, mouseWorld, g.events);
  } else if (p.mode === 'car' && p.car) {
    const ax = input.axis();
    const throttle = ax.y !== 0 ? -ax.y : 0; // W = up = forward
    const steer = ax.x;
    driveCar(p.car, dt, world, throttle, steer, topSpeed(p));
    p.x = p.car.x; p.y = p.car.y;
    p.angle = p.car.angle;
    if (p.car.wrecked) {
      p.mode = 'foot';
      p.x = p.car.x + 30; p.y = p.car.y;
      p.car = null;
      showToast('Your car is wrecked — on foot now');
    }
  }

  // Traffic + target cars.
  for (const car of g.cars) {
    if (car.kind === 'traffic') updateTraffic(car, dt, world, g.cars);
  }

  // Shooting heat: firing a gun near cops raises wanted (once per 5s).
  g.shootHeatT = Math.max(0, g.shootHeatT - dt);
  if (g.events.some(e => e.type === 'bullet' && e.from === 'player') && g.shootHeatT <= 0) {
    if (g.cops.length > 0) addWanted(g.wanted, 1, g.events);
    g.shootHeatT = 5;
  }

  // Bullets.
  updateBullets(dt);

  // Cops.
  ensureCops(g.cops, g.wanted, p, world, rng);
  const copResult = updateCops(g.cops, dt, g.wanted, p, world, g.events);
  if (copResult === 'arrested') {
    g.state = 'arrested';
    failStep(g.missions, 'Busted — the mission step reset');
    return;
  }
  if (copResult === 'dead' || p.hp <= 0) {
    if (p.mode === 'car' && p.car) { /* car wreck handled above */ }
    p.mode = 'dead';
    g.state = 'dead';
    failStep(g.missions, 'Wasted — the mission step reset');
    return;
  }

  // Cool-down zones: hiding here halves the evade timer.
  const px = p.mode === 'car' && p.car ? p.car.x : p.x;
  const py = p.mode === 'car' && p.car ? p.car.y : p.y;
  g.wanted.inCooldownZone = COOLDOWN_ZONES.some(z => px > z.x && px < z.x + z.w && py > z.y && py < z.y + z.h);

  // Missions.
  const beforeIdx = g.missions.index;
  updateMissions(g.missions, dt, { player: p, wanted: g.wanted, cars: g.cars, world, events: g.events, rng });
  if (g.missions.index !== beforeIdx) {
    saveGame();
    // Mission-start heat: late missions open hot.
    if (g.missions.index === 6) addWanted(g.wanted, 2, g.events);
    if (g.missions.index === 7) addWanted(g.wanted, 3, g.events);
  }
  g.objective = objectiveOf(g.missions);

  // Ambient robbery (outside rob mission steps).
  updateAmbientRob(dt, px, py);

  // Particles.
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const pt = g.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    if (pt.life <= 0) g.particles.splice(i, 1);
  }

  // Drain events.
  drainEvents();

  // Camera follows the player/car.
  updateCamera(g.cam, px, py, window.innerWidth, window.innerHeight);
}

function nearShop(p, shop) {
  return Math.hypot(p.x - shop.x, p.y - shop.y) < 110;
}

function updateAmbientRob(dt, px, py) {
  const step = currentStep(g.missions);
  const inRobMission = step && step.kind === 'rob';
  if (inRobMission || g.state !== 'playing') { g.ambientRobT = 0; g.ambientStore = null; return; }
  let store = null;
  for (const s of storePositions()) {
    if (Math.hypot(px - s.x, py - s.y) < 80) { store = s; break; }
  }
  if (store && g.player.mode === 'foot') {
    g.ambientStore = store;
    g.ambientRobT += dt;
    if (g.ambientRobT >= 3) {
      g.player.cash += 300;
      g.player.respect += 20;
      g.stats.robs += 1;
      addWanted(g.wanted, 2, g.events);
      g.events.push({ type: 'robbed', amount: 300 });
      showToast('Store robbed: +$300 — the cops are coming!');
      g.ambientRobT = 0;
      g.ambientStore = null;
    }
  } else {
    g.ambientRobT = Math.max(0, g.ambientRobT - dt * 2);
    g.ambientStore = null;
  }
}

function updateBullets(dt) {
  for (let i = g.bullets.length - 1; i >= 0; i--) {
    const b = g.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.range -= Math.hypot(b.vx, b.vy) * dt;
    if (b.range <= 0 || pointSolid(world, b.x, b.y)) {
      g.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.15, max: 0.15, size: 3, color: '#ffd24a' });
      g.bullets.splice(i, 1);
    }
  }
  // Bullets vs cops.
  const respect = bulletsVsCops(g.bullets, g.cops, world, g.events);
  if (respect > 0) { g.player.respect += respect; g.stats.copsDown += 1; addWanted(g.wanted, 1, g.events); }
  // Bullets vs cars (traffic / target / player car is never shot by the player).
  for (let i = g.bullets.length - 1; i >= 0; i--) {
    const b = g.bullets[i];
    if (b.from !== 'player') continue;
    for (const car of g.cars) {
      if (car.wrecked || car.kind === 'player') continue;
      if (Math.hypot(b.x - car.x, b.y - car.y) < 24) {
        damageCar(car, b.damage, g.events);
        g.bullets.splice(i, 1);
        if (car.kind === 'target' && car.wrecked) g.player.respect += 15;
        break;
      }
    }
  }
}

function drainEvents() {
  for (const e of g.events) {
    switch (e.type) {
      case 'sfx': playSfx(e.name, e.weapon); break;
      case 'bullet': g.bullets.push(e); break;
      case 'muzzle':
        g.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.08, max: 0.08, size: 6, color: '#ffe27a' });
        break;
      case 'explosion':
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2;
          g.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: 0.5, max: 0.5, size: 5, color: i % 2 ? '#ff7b2e' : '#ffd24a' });
        }
        playSfx('explosion');
        break;
      case 'missionComplete':
        showBanner('MISSION COMPLETE', e.mission.name + '  •  +$' + e.mission.reward + '  •  +' + e.mission.respect + ' respect');
        break;
      case 'gameComplete':
        clearBanner();
        g.state = 'complete';
        break;
      case 'evaded':
        g.player.cash += WANTED.evadeBonus;
        g.player.respect += WANTED.evadeRespect;
        g.stats.evades += 1;
        playSfx('evade');
        showToast('Clean getaway! +$' + WANTED.evadeBonus + '  •  +' + WANTED.evadeRespect + ' respect');
        break;
      case 'robbed':
        playSfx('robbed');
        break;
      default: break;
    }
  }
  g.events.length = 0;
}

function draw() {
  g.canvasW = window.innerWidth;
  g.canvasH = window.innerHeight;
  clearButtons();
  if (g.state === 'title') {
    // Draw the city behind the title for a living backdrop.
    if (!g.player) { g.player = createPlayer(1600, 1200); spawnWorld(); }
    updateCamera(g.cam, 1600, 1200, g.canvasW, g.canvasH);
    g.objective = null;
    render(ctx, g);
    drawTitle(ctx, g);
  } else if (g.state === 'paused') {
    render(ctx, g);
    drawHUD(ctx, g);
    drawPause(ctx, g);
  } else if (g.state === 'shop') {
    render(ctx, g);
    drawHUD(ctx, g);
    drawShop(ctx, g);
  } else if (g.state === 'dead') {
    render(ctx, g);
    drawEndOverlay(ctx, g, 'dead');
  } else if (g.state === 'arrested') {
    render(ctx, g);
    drawEndOverlay(ctx, g, 'arrested');
  } else if (g.state === 'complete') {
    render(ctx, g);
    drawHUD(ctx, g);
    drawEndOverlay(ctx, g, 'complete');
  } else {
    render(ctx, g);
    drawHUD(ctx, g);
  }
  // Ambient rob progress ring.
  if (g.ambientStore && g.ambientRobT > 0 && g.state === 'playing') {
    const s = g.ambientStore;
    const sx = s.x - g.cam.x, sy = s.y - g.cam.y;
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (g.ambientRobT / 3));
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ROBBING…', sx, sy - 40);
  }
}

// Fixed-timestep loop.
let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    update(STEP);
    acc -= STEP;
    steps++;
  }
  if (steps === 5) acc = 0;
  input.consumePressed();
  draw();
}
requestAnimationFrame(frame);
