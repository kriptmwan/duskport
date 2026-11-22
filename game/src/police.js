// Duskport — police: wanted stars, chases, line-of-sight evade, arrest.
import { WANTED, COP_COLOR, CAR } from './config.js';
import { losClear, nearestRoadPoint, collideCircle } from './world.js';
import { createCar, driveCar, damageCar } from './vehicles.js';

export function createWanted() {
  return {
    stars: 0,
    losT: 0,            // seconds since any cop saw the player
    hidden: false,
    drainT: 0,
    evadedAt: 0,        // stars evaded from (for the bonus)
    inCooldownZone: false,
  };
}

export function addWanted(w, n, events) {
  const before = w.stars;
  w.stars = Math.max(0, Math.min(5, w.stars + n));
  w.losT = 0;
  w.hidden = false;
  if (w.stars > before && events) events.push({ type: 'sfx', name: 'siren' });
  return w.stars;
}

export function createCop(x, y, onFoot) {
  if (onFoot) {
    return { kind: 'foot', x, y, angle: 0, speed: 0, hp: 50, arrestT: 0, r: 13 };
  }
  const car = createCar(x, y, 0, COP_COLOR, 'cop');
  car.hp = 120; car.maxHp = 120;
  return { kind: 'car', car, x, y, angle: 0, hp: 120, arrestT: 0, r: 20 };
}

// Spawn cops until the count matches the wanted level. Cops appear on roads
// ~500-700px from the player (just off view).
export function ensureCops(cops, w, player, world, rng) {
  const want = WANTED.maxCops[w.stars];
  while (cops.length < want) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(500, 700);
    let x = player.x + Math.cos(a) * d;
    let y = player.y + Math.sin(a) * d;
    x = Math.max(60, Math.min(3100, x));
    y = Math.max(60, Math.min(2340, y));
    const rp = nearestRoadPoint(x, y);
    const onFoot = w.stars >= 2 && player.mode === 'foot' && rng.chance(0.5);
    const cop = createCop(rp.x, rp.y, onFoot);
    cops.push(cop);
  }
  // Too many cops (stars fell): let extras drive off — remove one per second.
  if (cops.length > want && w.stars === 0) {
    cops.splice(0, cops.length - want);
  }
}

// Update all cops. Returns 'arrested' when the player is cuffed.
export function updateCops(cops, dt, w, player, world, events) {
  let anyLos = false;
  let result = null;
  const px = player.mode === 'car' && player.car ? player.car.x : player.x;
  const py = player.mode === 'car' && player.car ? player.car.y : player.y;

  for (let i = cops.length - 1; i >= 0; i--) {
    const cop = cops[i];
    if (cop.kind === 'car') {
      const car = cop.car;
      if (car.wrecked) {
        // Wrecked cop car: remove after a while, give respect once.
        car.sirenT += dt;
        if (car.sirenT > 6) cops.splice(i, 1);
        continue;
      }
      // Chase: steer toward the player with a wobble, ram on contact.
      const wantAngle = Math.atan2(py - car.y, px - car.x);
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const wobble = Math.sin((car.id || 1) * 7 + performance.now() / 900) * 0.15;
      const steer = Math.max(-1, Math.min(1, diff * 2 + wobble));
      const top = WANTED.copSpeed[w.stars] || 300;
      driveCar(car, dt, world, 1, steer, top);
      cop.x = car.x; cop.y = car.y; cop.angle = car.angle;
      // Ram the player's car.
      if (player.mode === 'car' && player.car) {
        const d = Math.hypot(car.x - player.car.x, car.y - player.car.y);
        if (d < 44) {
          damageCar(player.car, 6 * dt * 10, null);
          player.car.speed *= 0.98;
          if (Math.abs(car.speed) > 200) events.push({ type: 'sfx', name: 'crash' });
        }
      } else if (player.mode === 'foot') {
        const d = Math.hypot(car.x - player.x, car.y - player.y);
        if (d < 40) {
          // Cop car nudges the player on foot: shove + hurt.
          player.x += ((player.x - car.x) / (d || 1)) * 30 * dt * 10;
          player.hp -= 12 * dt;
          if (player.hp <= 0) result = 'dead';
        }
      }
      if (losClear(world, car.x, car.y, px, py)) anyLos = true;
    } else {
      // Foot cop: run at the player, cuff when close.
      const d = Math.hypot(px - cop.x, py - cop.y);
      const sp = 250;
      if (d > 4) {
        cop.angle = Math.atan2(py - cop.y, px - cop.x);
        const nx = cop.x + Math.cos(cop.angle) * sp * dt;
        const ny = cop.y + Math.sin(cop.angle) * sp * dt;
        const r = collideCircle(world, nx, ny, cop.r);
        cop.x = r.x; cop.y = r.y;
      }
      if (player.mode === 'foot' && d < 30) {
        cop.arrestT += dt;
        player.arrestT = cop.arrestT;
        player.arrestRing = Math.min(1, cop.arrestT / 2.0);
        // Cuffed: the player slows to a crawl.
        if (cop.arrestT >= 2.0) result = 'arrested';
      } else {
        cop.arrestT = Math.max(0, cop.arrestT - dt);
        player.arrestT = 0;
        player.arrestRing = 0;
      }
      if (losClear(world, cop.x, cop.y, px, py)) anyLos = true;
    }
  }

  // Line-of-sight evade: no cop sees the player -> cooldown -> stars drain.
  if (anyLos) {
    w.losT = 0;
    w.hidden = false;
    w.drainT = 0;
  } else if (w.stars > 0) {
    w.losT += dt;
    const cd = w.inCooldownZone ? WANTED.evadeCooldown / 2 : WANTED.evadeCooldown;
    if (w.losT > cd) {
      w.hidden = true;
      w.drainT += dt;
      if (w.drainT >= WANTED.starDrain) {
        w.drainT = 0;
        w.stars -= 1;
        if (w.stars === 0) {
          events.push({ type: 'evaded', fromStars: w.evadedAt || 1 });
          w.evadedAt = 0;
        }
      }
    }
  }
  if (w.stars > 0 && w.evadedAt === 0) w.evadedAt = w.stars;
  return result;
}

// Bullets vs cops. Returns points of respect earned this call.
export function bulletsVsCops(bullets, cops, world, events) {
  let respect = 0;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (b.from !== 'player') continue;
    for (let j = cops.length - 1; j >= 0; j--) {
      const cop = cops[j];
      const cx = cop.kind === 'car' ? cop.car.x : cop.x;
      const cy = cop.kind === 'car' ? cop.car.y : cop.y;
      const rr = cop.kind === 'car' ? 22 : 15;
      const d = Math.hypot(b.x - cx, b.y - cy);
      if (d < rr) {
        bullets.splice(i, 1);
        if (cop.kind === 'car') {
          damageCar(cop.car, b.damage, events);
          if (cop.car.wrecked) {
            respect += 20;
            events.push({ type: 'sfx', name: 'explosion' });
          }
        } else {
          cop.hp -= b.damage;
          if (cop.hp <= 0) {
            respect += 10;
            cops.splice(j, 1);
            events.push({ type: 'sfx', name: 'down' });
          }
        }
        break;
      }
    }
  }
  return respect;
}
