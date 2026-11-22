// Duskport — vehicles: arcade car physics, traffic AI, parked cars, wrecks.
import { CAR, TRAFFIC_COLORS } from './config.js';
import { collideCircle, isOnRoad, nearestRoadPoint } from './world.js';

let nextId = 1;

export function createCar(x, y, angle, color, kind = 'traffic') {
  return {
    id: nextId++,
    x, y, angle, speed: 0,
    color,
    kind,                 // 'player' | 'traffic' | 'parked' | 'cop' | 'target'
    hp: CAR.hp, maxHp: CAR.hp,
    wrecked: false,
    // traffic AI
    road: null, dir: 1, cruise: 0, stuckT: 0,
    sirenT: 0,
  };
}

export function makeTrafficCar(rng, world, color) {
  // Spawn on a random road point, aligned with the road.
  const vertical = rng.chance(0.5);
  let x, y, angle;
  if (vertical) {
    x = rng.pick([250, 750, 1250, 1750, 2250, 2750, 3050]);
    y = rng.range(100, 2300);
    angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
  } else {
    x = rng.range(100, 3000);
    y = rng.pick([250, 650, 1050, 1450, 1850, 2150]);
    angle = rng.chance(0.5) ? 0 : Math.PI;
  }
  const car = createCar(x, y, angle, color || rng.pick(TRAFFIC_COLORS), 'traffic');
  car.road = vertical ? 'v' : 'h';
  car.dir = angle === 0 || angle === Math.PI / 2 ? 1 : -1;
  car.cruise = rng.range(140, 220);
  return car;
}

export function makeParkedCar(rng, x, y, angle) {
  const car = createCar(x, y, angle, rng.pick(TRAFFIC_COLORS), 'parked');
  car.hp = CAR.hp; car.maxHp = CAR.hp;
  return car;
}

// Arcade driving: speed is a scalar along the heading; steering scales with speed.
export function driveCar(car, dt, world, throttle, steer, topSpeed) {
  if (car.wrecked) { car.speed *= Math.max(0, 1 - 4 * dt); return; }
  const max = topSpeed || CAR.maxSpeed;
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 30) car.speed -= CAR.brake * dt;
    else car.speed += CAR.reverseAccel * throttle * dt; // throttle negative -> reverse
  } else {
    car.speed -= Math.sign(car.speed) * 240 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(max, car.speed));
  const spd01 = Math.min(1, Math.abs(car.speed) / max);
  car.angle += steer * CAR.steer * spd01 * Math.sign(car.speed || 1) * dt;
  // Lateral grip: velocity is mostly along heading (arcade, no drift model).
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const r = collideCircle(world, nx, ny, CAR.radius);
  if (r.hit && Math.abs(car.speed) > 120) {
    car.hp -= Math.abs(car.speed) * 0.05;
    car.speed *= 0.4;
  } else if (r.hit) {
    car.speed *= 0.5;
  }
  car.x = r.x; car.y = r.y;
  if (car.hp <= 0 && !car.wrecked) {
    car.wrecked = true;
    car.speed = 0;
  }
}

export function damageCar(car, amount, events) {
  if (car.wrecked) return;
  car.hp -= amount;
  if (events) events.push({ type: 'sfx', name: 'hit' });
  if (car.hp <= 0) {
    car.hp = 0;
    car.wrecked = true;
    car.speed = 0;
    if (events) events.push({ type: 'explosion', x: car.x, y: car.y });
  }
}

// Simple traffic: follow the current road line; at intersections sometimes turn.
// Slows when a car is directly ahead. Stays on roads by construction.
export function updateTraffic(car, dt, world, cars) {
  if (car.wrecked) return;
  const ahead = carAhead(car, cars);
  const target = ahead ? Math.max(0, car.cruise * 0.35) : car.cruise;
  car.speed += (target - car.speed) * Math.min(1, 2 * dt);

  // Keep aligned to the road line; nudge back if drifted.
  const roadPt = nearestRoadPoint(car.x, car.y);
  if (car.road === 'v') {
    car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.x += (roadPt.x - car.x) * Math.min(1, 3 * dt);
  } else {
    car.angle = car.dir > 0 ? 0 : Math.PI;
    car.y += (roadPt.y - car.y) * Math.min(1, 3 * dt);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const r = collideCircle(world, nx, ny, CAR.radius);
  car.x = r.x; car.y = r.y;

  // At an intersection, sometimes turn onto the crossing road.
  const onV = Math.abs(car.x - nearestRoadPoint(car.x, car.y).x) < 6;
  const onH = Math.abs(car.y - nearestRoadPoint(car.x, car.y).y) < 6;
  if (onV && onH && Math.random() < 0.006) {
    if (car.road === 'v') { car.road = 'h'; car.dir = Math.random() < 0.5 ? 1 : -1; }
    else { car.road = 'v'; car.dir = Math.random() < 0.5 ? 1 : -1; }
  }
  // Bounce off world edges by reversing direction.
  if (car.x < 80 || car.x > 3120 - 80 || car.y < 80 || car.y > 2320) car.dir *= -1;
}

function carAhead(car, cars) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  for (const o of cars) {
    if (o === car || o.wrecked) continue;
    const dx = o.x - car.x, dy = o.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < 90 && side < 26) return true;
  }
  return false;
}

// Distance from a point to the nearest parked/traffic car (for E to enter).
export function nearestEnterableCar(cars, x, y, maxDist = 70) {
  let best = null, bestD = maxDist;
  for (const c of cars) {
    if (c.wrecked || c.kind === 'cop') continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
