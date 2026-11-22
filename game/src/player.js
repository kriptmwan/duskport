// Duskport — player: on-foot movement + shooting, car entry, weapons, HP.
import { PLAYER, WEAPONS, UPGRADES } from './config.js';
import { collideCircle } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: 0,
    mode: 'foot',           // 'foot' | 'car' | 'dead' | 'arrested'
    hp: PLAYER.hp,
    cash: 150,
    respect: 0,
    car: null,              // car object when mode === 'car'
    weapons: {
      pistol: { owned: true, ammo: Infinity },
      smg: { owned: false, ammo: 0 },
      shotgun: { owned: false, ammo: 0 },
    },
    weapon: 'pistol',
    mag: WEAPONS.pistol.mag,
    reloadT: 0,
    fireT: 0,
    arrestT: 0,             // seconds a cop has held the player
    arrestRing: 0,          // 0..1 progress shown on HUD
    engineLevel: 0,
    armorLevel: 0,
    walkBob: 0,
  };
}

export function rankName(respect) {
  const ranks = ['Street', 'Hustler', 'Runner', 'Boss', 'Kingpin'];
  const marks = [0, 150, 350, 600, 850];
  let r = 0;
  for (let i = 0; i < marks.length; i++) if (respect >= marks[i]) r = i;
  return ranks[r];
}

export function maxCarHp(p) {
  return UPGRADES.armor[p.armorLevel].hp;
}

export function topSpeed(p) {
  return UPGRADES.engine[p.engineLevel].topSpeed;
}

export function ownedWeapons(p) {
  return Object.keys(p.weapons).filter(w => p.weapons[w].owned);
}

// Switch weapon (1/2/3). Returns true if switched.
export function selectWeapon(p, key) {
  const order = ['pistol', 'smg', 'shotgun'];
  const w = order[Number(key) - 1];
  if (!w || !p.weapons[w].owned || p.weapon === w) return false;
  p.weapon = w;
  p.mag = WEAPONS[w].mag;
  p.reloadT = 0;
  return true;
}

// Fire the current weapon. Pushes bullet events into `events`.
export function tryShoot(p, targetX, targetY, events) {
  if (p.mode !== 'foot' || p.fireT > 0 || p.reloadT > 0) return false;
  const w = WEAPONS[p.weapon];
  if (p.mag <= 0) {
    startReload(p);
    return false;
  }
  const base = Math.atan2(targetY - p.y, targetX - p.x);
  const n = w.pellets || 1;
  for (let i = 0; i < n; i++) {
    const a = base + (Math.random() - 0.5) * 2 * w.spread + (n > 1 ? (i - (n - 1) / 2) * 0.09 : 0);
    events.push({
      type: 'bullet', x: p.x + Math.cos(base) * 22, y: p.y + Math.sin(base) * 22,
      vx: Math.cos(a) * w.bulletSpeed, vy: Math.sin(a) * w.bulletSpeed,
      damage: w.damage, range: w.range, from: 'player',
    });
  }
  p.mag -= 1;
  p.fireT = 1 / w.rate;
  events.push({ type: 'sfx', name: 'shoot', weapon: p.weapon });
  events.push({ type: 'muzzle', x: p.x + Math.cos(base) * 22, y: p.y + Math.sin(base) * 22 });
  if (p.mag <= 0) startReload(p);
  return true;
}

function startReload(p) {
  const w = WEAPONS[p.weapon];
  if (p.weapon !== 'pistol' && p.weapons[p.weapon].ammo <= 0) return; // nothing to load
  p.reloadT = w.reload;
}

function finishReload(p) {
  const w = WEAPONS[p.weapon];
  if (p.weapon === 'pistol') {
    p.mag = w.mag;
    return;
  }
  const inv = p.weapons[p.weapon];
  const need = w.mag;
  const take = Math.min(need, inv.ammo);
  inv.ammo -= take;
  p.mag = take;
}

export function updatePlayer(p, dt, input, world, mouseWorld, events) {
  p.fireT = Math.max(0, p.fireT - dt);
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) finishReload(p);
  }
  if (p.mode !== 'foot') return;

  const ax = input.axis();
  const moving = ax.x !== 0 || ax.y !== 0;
  const speed = input.down('Shift') ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (moving) {
    const len = Math.hypot(ax.x, ax.y);
    const nx = p.x + (ax.x / len) * speed * dt;
    const ny = p.y + (ax.y / len) * speed * dt;
    // Move axis-separated so the player slides along walls.
    const rx = collideCircle(world, nx, p.y, PLAYER.radius);
    p.x = rx.x;
    const ry = collideCircle(world, p.x, ny, PLAYER.radius);
    p.y = ry.y;
    p.walkBob += dt * 10;
  }
  p.angle = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
  const m = input.mouse();
  if (m.down) tryShoot(p, mouseWorld.x, mouseWorld.y, events);
  if (input.wasPressed('1')) selectWeapon(p, '1');
  if (input.wasPressed('2')) selectWeapon(p, '2');
  if (input.wasPressed('3')) selectWeapon(p, '3');
}

// Apply damage. Returns 'dead' when HP hits 0.
export function damagePlayer(p, amount, events) {
  if (p.mode === 'dead' || p.mode === 'arrested') return null;
  p.hp -= amount;
  events.push({ type: 'sfx', name: 'hurt' });
  if (p.hp <= 0) {
    p.hp = 0;
    p.mode = 'dead';
    return 'dead';
  }
  return null;
}

// Death by cop / crash: hospital respawn, lose cash, keep weapons.
export function respawnHospital(p, world) {
  p.x = 1750; p.y = 760; // outside Duskport General
  p.mode = 'foot';
  p.hp = PLAYER.hp;
  p.cash = Math.floor(p.cash * (1 - PLAYER.respawnCashLoss));
  p.car = null;
  p.arrestT = 0; p.arrestRing = 0;
}

// Arrest: police station respawn, lose cash + temporarily lose bought guns.
export function respawnArrested(p) {
  p.x = 2250; p.y = 1160; // outside DPD Central
  p.mode = 'foot';
  p.hp = PLAYER.hp;
  p.cash = Math.floor(p.cash * (1 - PLAYER.respawnCashLoss));
  p.car = null;
  p.arrestT = 0; p.arrestRing = 0;
  // Confiscated: bought weapons removed (pistol stays).
  for (const w of ['smg', 'shotgun']) {
    if (p.weapons[w].owned) { p.weapons[w].owned = false; p.weapons[w].ammo = 0; }
  }
  p.weapon = 'pistol';
  p.mag = WEAPONS.pistol.mag;
}
