// Duskport — render: camera + canvas drawing of the city, cars, player, effects.
import { WORLD, ROADS_X, ROADS_Y, DISTRICTS, COOLDOWN_ZONES, COP_COLOR } from './config.js';
import { WATER } from './world.js';

export function createCamera() {
  return { x: 0, y: 0, w: 1280, h: 800 };
}

export function updateCamera(cam, tx, ty, viewW, viewH) {
  cam.w = viewW; cam.h = viewH;
  cam.x = Math.max(0, Math.min(WORLD.width - viewW, tx - viewW / 2));
  cam.y = Math.max(0, Math.min(WORLD.height - viewH, ty - viewH / 2));
}

function hash(n) {
  let h = (n * 2654435761) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function render(ctx, g) {
  const cam = g.cam;
  const W = g.canvasW, H = g.canvasH;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.translate(-cam.x, -cam.y);

  const x0 = cam.x - 60, y0 = cam.y - 60, x1 = cam.x + cam.w + 60, y1 = cam.y + cam.h + 60;

  // Ground: district tints.
  ctx.fillStyle = '#20242e';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (const d of DISTRICTS) {
    ctx.fillStyle = '#262c3a';
    ctx.fillRect(Math.max(x0, d.x), Math.max(y0, d.y), Math.min(x1, d.x + d.w) - Math.max(x0, d.x), Math.min(y1, d.y + d.h) - Math.max(y0, d.y));
  }
  // Park + pier (cool-down zones).
  for (const z of COOLDOWN_ZONES) {
    ctx.fillStyle = '#1e3320';
    ctx.fillRect(z.x, z.y, z.w, z.h);
  }
  // Water strip (east edge).
  ctx.fillStyle = '#16324a';
  ctx.fillRect(WATER.x, WATER.y, WATER.w, WATER.h);
  ctx.fillStyle = 'rgba(120,200,255,0.25)';
  for (let y = 0; y < WORLD.height; y += 90) ctx.fillRect(WATER.x + 8, y + ((g.time * 20) % 90), 64, 3);

  // Roads.
  ctx.fillStyle = '#10131a';
  for (const rx of ROADS_X) ctx.fillRect(rx - 46, 0, 92, WORLD.height);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - 46, WORLD.width, 92);
  // Centre dashes.
  ctx.fillStyle = 'rgba(255,220,120,0.5)';
  for (const rx of ROADS_X) {
    for (let y = 0; y < WORLD.height; y += 64) ctx.fillRect(rx - 2, y, 4, 28);
  }
  for (const ry of ROADS_Y) {
    for (let x = 0; x < WORLD.width; x += 64) ctx.fillRect(x, ry - 2, 28, 4);
  }
  // District labels on the ground.
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.label + '55';
    ctx.fillText(d.name.toUpperCase(), d.x + d.w / 2, d.y + d.h / 2);
  }

  // Buildings (only those in view).
  for (let i = 0; i < g.world.buildings.length; i++) {
    const b = g.world.buildings[i];
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    const d = DISTRICTS[b.district];
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = d.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = d.wall;
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Windows: deterministic per building.
    ctx.fillStyle = d.win;
    const cols = Math.max(1, Math.floor(b.w / 22));
    const rows = Math.max(1, Math.floor(b.h / 20));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if (hash(i * 131 + cx * 17 + cy * 7) < 0.55) {
          ctx.fillRect(b.x + 8 + cx * 22, b.y + 8 + cy * 20, 9, 7);
        }
      }
    }
    if (b.label) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
  }

  // Trees.
  for (const t of g.world.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = '#2c5a2e';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f7a3a';
    ctx.beginPath(); ctx.arc(t.x - 2, t.y - 2, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // Mission objective beam + marker.
  const obj = g.objective;
  if (obj && g.state === 'playing') {
    const pulse = 0.5 + Math.sin(g.time * 4) * 0.5;
    ctx.fillStyle = `rgba(255,210,74,${0.10 + pulse * 0.10})`;
    ctx.fillRect(obj.x - 30, obj.y - 240, 60, 240);
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, 24 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(obj.x, obj.y - 14); ctx.lineTo(obj.x + 10, obj.y + 8); ctx.lineTo(obj.x - 10, obj.y + 8);
    ctx.closePath(); ctx.fill();
  }

  // Cars.
  for (const car of g.cars) drawCar(ctx, car, g);
  // Cops.
  for (const cop of g.cops) {
    if (cop.kind === 'car') drawCar(ctx, cop.car, g, true);
    else {
      ctx.fillStyle = COP_COLOR;
      ctx.beginPath(); ctx.arc(cop.x, cop.y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', cop.x, cop.y + 3);
    }
  }
  // Player.
  drawPlayer(ctx, g);

  // Bullets.
  ctx.strokeStyle = '#ffe27a';
  ctx.lineWidth = 3;
  for (const b of g.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.stroke();
  }
  // Particles.
  for (const pt of g.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Dusk overlay: subtle day/night cycle over 4 minutes.
  const night = 0.5 + 0.5 * Math.sin((g.timeOfDay / 240) * Math.PI * 2 - Math.PI / 2);
  ctx.fillStyle = `rgba(8,10,40,${(0.10 + night * 0.20).toFixed(3)})`;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  ctx.restore();
}

function drawCar(ctx, car, g, isCop = false) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRectPath(ctx, -20 + 3, -10 + 4, 42, 20, 6);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  roundRectPath(ctx, -21, -11, 42, 22, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Cabin / windshield.
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  roundRectPath(ctx, -6, -9, 14, 18, 4);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(-15, -13, 9, 4); ctx.fillRect(-15, 9, 9, 4);
  ctx.fillRect(7, -13, 9, 4); ctx.fillRect(7, 9, 9, 4);
  // Headlights.
  const night = 0.5 + 0.5 * Math.sin((g.timeOfDay / 240) * Math.PI * 2 - Math.PI / 2);
  if (night > 0.4 && !car.wrecked) {
    ctx.fillStyle = 'rgba(255,240,170,0.75)';
    ctx.beginPath(); ctx.arc(21, -7, 3, 0, Math.PI * 2); ctx.arc(21, 7, 3, 0, Math.PI * 2); ctx.fill();
  }
  if (isCop) {
    // Light bar, flashing red/blue.
    const flash = Math.floor(g.time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#2e7bff';
    ctx.fillRect(-2, -11, 5, 6);
    ctx.fillStyle = flash ? '#2e7bff' : '#ff2e2e';
    ctx.fillRect(-2, 5, 5, 6);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-21, -11, 42, 3);
  }
  // Wreck smoke.
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath(); ctx.arc(-4, -4, 8 + Math.sin(g.time * 3) * 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Car HP bar for the player's car / target cars.
  if ((car.kind === 'player' || car.kind === 'target') && !car.wrecked && car.hp < car.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(car.x - 24, car.y - 34, 48, 6);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(car.x - 24, car.y - 34, 48 * Math.max(0, car.hp / car.maxHp), 6);
  }
}

function drawPlayer(ctx, g) {
  const p = g.player;
  if (p.mode === 'car' || p.mode === 'dead' || p.mode === 'arrested') return;
  ctx.save();
  ctx.translate(p.x, p.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(2, 3, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
  // Body.
  ctx.fillStyle = '#ffcf3f';
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#7a5b00';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Gun direction.
  ctx.rotate(p.angle);
  ctx.fillStyle = '#222';
  ctx.fillRect(8, -2.5, 18, 5);
  ctx.restore();
}
