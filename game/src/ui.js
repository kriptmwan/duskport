// Duskport — UI: canvas HUD, minimap, menus, toasts. All UI is drawn on the
// game canvas so screenshots show it. Buttons are hit-tested by main.js.
import { WEAPONS, UPGRADES, RESPECT_RANKS, MISSIONS, SHOPS } from './config.js';
import { rankName } from './player.js';

let buttons = [];
let toast = null;
let banner = null;

export function getButtons() { return buttons; }
export function clearButtons() { buttons = []; }

export function showToast(text, seconds = 3) { toast = { text, t: seconds }; }
export function showBanner(title, sub, seconds = 3.5) { banner = { title, sub, t: seconds }; }

export function tickUi(dt) {
  if (toast) { toast.t -= dt; if (toast.t <= 0) toast = null; }
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
}

function button(ctx, id, x, y, w, h, label, enabled = true) {
  ctx.fillStyle = enabled ? 'rgba(20,24,38,0.92)' : 'rgba(40,40,40,0.85)';
  ctx.strokeStyle = enabled ? '#ffd24a' : '#555';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = enabled ? '#fff' : '#888';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  buttons.push({ id, x, y, w, h, enabled });
}

function panel(ctx, x, y, w, h, alpha = 0.88) {
  ctx.fillStyle = `rgba(12,16,28,${alpha})`;
  ctx.strokeStyle = 'rgba(255,210,74,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill(); ctx.stroke();
}

function stars(ctx, cx, y, n, size = 22) {
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < n ? '#ffcf3f' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', cx + (i - 2) * (size + 4), y);
  }
}

export function drawHUD(ctx, g) {
  const W = g.canvasW, H = g.canvasH;
  const p = g.player, w = g.wanted;
  ctx.textBaseline = 'alphabetic';

  // Top-left: cash + respect.
  panel(ctx, 12, 12, 250, 74, 0.72);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('$' + p.cash.toLocaleString(), 26, 42);
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(rankName(p.respect) + '  •  Respect ' + p.respect, 26, 64);
  const next = RESPECT_RANKS.find(r => r.at > p.respect);
  const prevAt = [...RESPECT_RANKS].reverse().find(r => r.at <= p.respect)?.at || 0;
  const frac = next ? (p.respect - prevAt) / (next.at - prevAt) : 1;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(26, 70, 222, 6);
  ctx.fillStyle = '#ffd24a';
  ctx.fillRect(26, 70, 222 * Math.max(0, Math.min(1, frac)), 6);

  // Top-center: wanted stars + state.
  stars(ctx, W / 2, 34, w.stars);
  if (w.stars > 0) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = w.hidden ? '#7dff8a' : '#ff6b6b';
    ctx.fillText(w.hidden ? 'HIDDEN — stay out of sight' : 'WANTED — break line of sight!', W / 2, 58);
  }

  // Bottom-left: HP + weapon.
  panel(ctx, 12, H - 86, 250, 74, 0.72);
  ctx.fillStyle = '#ff6b6b';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HP ' + Math.ceil(p.hp), 26, H - 58);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(26, H - 48, 222, 8);
  ctx.fillStyle = p.hp > 30 ? '#7dff8a' : '#ff6b6b';
  ctx.fillRect(26, H - 48, 222 * Math.max(0, p.hp / 100), 8);
  const wdef = WEAPONS[p.weapon];
  const ammo = p.weapon === 'pistol' ? '∞' : `${p.mag} / ${p.weapons[p.weapon].ammo}`;
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`${wdef.name}  ${p.reloadT > 0 ? 'RELOADING…' : ammo}   [1/2/3]`, 26, H - 26);

  // Bottom-center: current objective.
  const obj = g.objective;
  if (obj) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(obj.text).width;
    panel(ctx, W / 2 - tw / 2 - 16, H - 52, tw + 32, 34, 0.72);
    ctx.fillStyle = '#ffd24a';
    ctx.fillText(obj.text, W / 2, H - 29);
  }

  // Bottom-right: speed + radio.
  if (p.mode === 'car' && p.car) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.12) + ' mph', W - 24, H - 96);
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('CAR HP ' + Math.ceil(p.car.hp) + ' / ' + p.car.maxHp, W - 24, H - 76);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('♪ ' + g.radio + '  [R]', W - 24, H - 52);

  // Arrest cuff ring progress.
  if (p.arrestRing > 0) {
    ctx.strokeStyle = '#ff3b3b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.arrestRing);
    ctx.stroke();
    ctx.fillStyle = '#ff3b3b';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CUFFED — MOVE!', W / 2, H / 2 - 56);
  }

  // GPS arrow at screen edge toward the objective.
  if (obj) drawGpsArrow(ctx, g, obj);

  // Toast + banner.
  if (toast) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(toast.text).width;
    panel(ctx, W / 2 - tw / 2 - 14, 84, tw + 28, 32, 0.8);
    ctx.fillStyle = '#fff';
    ctx.fillText(toast.text, W / 2, 106);
  }
  if (banner) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, H * 0.3, W, 92);
    ctx.fillStyle = '#ffd24a';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(banner.title, W / 2, H * 0.3 + 40);
    ctx.fillStyle = '#fff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText(banner.sub, W / 2, H * 0.3 + 70);
  }

  drawMinimap(ctx, g);
}

function drawGpsArrow(ctx, g, obj) {
  const W = g.canvasW, H = g.canvasH;
  const cx = W / 2, cy = H / 2;
  const dx = obj.x - g.cam.x, dy = obj.y - g.cam.y;
  const dist = Math.hypot(dx, dy);
  const viewR = Math.hypot(W, H) / 2;
  if (dist < viewR * 0.75) {
    // On screen: draw a pulsing marker ring at the target.
    const t = performance.now() / 300;
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, 26 + Math.sin(t) * 5, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  const a = Math.atan2(dy, dx);
  const ex = cx + Math.cos(a) * (Math.min(W, H) / 2 - 60);
  const ey = cy + Math.sin(a) * (Math.min(W, H) / 2 - 60);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4, 0); ctx.lineTo(-10, 11);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(dist) + 'm', ex, ey + 28);
}

export function drawMinimap(ctx, g) {
  const W = g.canvasW;
  const mw = 210, mh = 158, mx = W - mw - 14, my = 14;
  const sx = mw / 3200, sy = mh / 2400;
  panel(ctx, mx - 6, my - 6, mw + 12, mh + 12, 0.72);
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#1c2436';
  ctx.fillRect(mx, my, mw, mh);
  // Water strip.
  ctx.fillStyle = '#274b63';
  ctx.fillRect(mx + 3120 * sx, my, 80 * sx, mh);
  // Roads.
  ctx.fillStyle = '#3a4358';
  for (const rx of [250, 750, 1250, 1750, 2250, 2750, 3050]) ctx.fillRect(mx + (rx - 46) * sx, my, 92 * sx, mh);
  for (const ry of [250, 650, 1050, 1450, 1850, 2150]) ctx.fillRect(mx, my + (ry - 46) * sy, mw, 92 * sy);
  // Buildings.
  ctx.fillStyle = '#5a6a8a';
  for (const b of g.world.buildings) ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  // Shops.
  ctx.fillStyle = '#7dff8a';
  for (const s of Object.values(SHOPS)) { ctx.beginPath(); ctx.arc(mx + s.x * sx, my + s.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
  // Mission objective.
  const obj = g.objective;
  if (obj) {
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.arc(mx + obj.x * sx, my + obj.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Cops.
  ctx.fillStyle = '#ff5b5b';
  for (const c of g.cops) { ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
  // Player.
  const p = g.player;
  const px = p.mode === 'car' && p.car ? p.car.x : p.x;
  const py = p.mode === 'car' && p.car ? p.car.y : p.y;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(mx + px * sx, my + py * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx + px * sx, my + py * sy, 6, 0, Math.PI * 2); ctx.stroke();
  // View rect.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeRect(mx + g.cam.x * sx, my + g.cam.y * sy, g.cam.w * sx, g.cam.h * sy);
  ctx.restore();
}

function menuShell(ctx, g, title, sub) {
  const W = g.canvasW, H = g.canvasH;
  ctx.fillStyle = 'rgba(8,10,20,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(title, W / 2, H * 0.24);
  if (sub) {
    ctx.fillStyle = '#fff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(sub, W / 2, H * 0.24 + 34);
  }
  return { W, H };
}

export function drawTitle(ctx, g) {
  const { W, H } = menuShell(ctx, g, 'DUSKPORT', 'A neon open-world crime game  •  five districts, one city to take');
  ctx.fillStyle = '#cdd7ea';
  ctx.font = '16px system-ui, sans-serif';
  const lines = [
    'WASD move / drive   •   Mouse aim, Click shoot   •   E enter & exit cars',
    '1 / 2 / 3 weapons   •   M map   •   P pause   •   R radio   •   Rob stores, lose the cops, get paid',
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H * 0.38 + i * 26));
  const cx = W / 2;
  if (g.saveExists) button(ctx, 'continue', cx - 130, H * 0.52, 260, 52, 'CONTINUE — Mission ' + (g.saveMission + 1));
  button(ctx, 'new', cx - 130, H * (g.saveExists ? 0.62 : 0.55), 260, 52, g.saveExists ? 'NEW GAME' : 'START — NEW GAME');
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Original city, story and music. Nothing from any commercial game.', W / 2, H - 28);
}

export function drawPause(ctx, g) {
  const { W, H } = menuShell(ctx, g, 'PAUSED', 'Duskport waits for no one — except right now');
  const cx = W / 2;
  button(ctx, 'resume', cx - 130, H * 0.4, 260, 48, 'RESUME');
  button(ctx, 'save', cx - 130, H * 0.4 + 60, 260, 48, 'SAVE GAME');
  button(ctx, 'restart', cx - 130, H * 0.4 + 120, 260, 48, 'RESTART FROM MISSION 1');
  button(ctx, 'quit', cx - 130, H * 0.4 + 180, 260, 48, 'QUIT TO TITLE');
}

export function drawShop(ctx, g) {
  const { W, H } = menuShell(ctx, g, g.shopTab === 'garage' ? 'MARA\u2019S GARAGE' : 'IRON & LEAD GUNS', 'Cash: $' + g.player.cash.toLocaleString());
  const cx = W / 2;
  button(ctx, 'tab-garage', cx - 270, H * 0.32, 260, 44, 'GARAGE');
  button(ctx, 'tab-guns', cx + 10, H * 0.32, 260, 44, 'GUN SHOP');
  const items = g.shopTab === 'garage'
    ? [
        { id: 'engine', name: 'Engine — ' + UPGRADES.engine[g.player.engineLevel].name + ' → ' + (UPGRADES.engine[g.player.engineLevel + 1]?.name || 'MAX'), price: UPGRADES.engine[g.player.engineLevel + 1]?.price, can: g.player.engineLevel < 2 },
        { id: 'armor', name: 'Armor — ' + UPGRADES.armor[g.player.armorLevel].name + ' → ' + (UPGRADES.armor[g.player.armorLevel + 1]?.name || 'MAX'), price: UPGRADES.armor[g.player.armorLevel + 1]?.price, can: g.player.armorLevel < 2 },
      ]
    : [
        { id: 'buy-smg', name: 'VK-9 SMG', price: 800, can: !g.player.weapons.smg.owned },
        { id: 'buy-shotgun', name: 'M12 Scatter', price: 1200, can: !g.player.weapons.shotgun.owned },
        { id: 'ammo-smg', name: 'SMG ammo ×60', price: 60, can: g.player.weapons.smg.owned },
        { id: 'ammo-shotgun', name: 'Shotgun shells ×24', price: 90, can: g.player.weapons.shotgun.owned },
      ];
  items.forEach((it, i) => {
    const y = H * 0.42 + i * 62;
    ctx.fillStyle = '#fff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(it.name, cx - 270, y + 18);
    const afford = it.can && g.player.cash >= (it.price || 0);
    button(ctx, it.id, cx + 130, y, 140, 40, it.can ? '$' + (it.price || 0) : 'OWNED', afford);
  });
  button(ctx, 'shop-close', cx - 130, H * 0.42 + items.length * 62 + 16, 260, 48, 'BACK TO THE STREETS [E]');
}

export function drawEndOverlay(ctx, g, kind) {
  const { W, H } = menuShell(ctx, g,
    kind === 'dead' ? 'WASTED' : kind === 'arrested' ? 'BUSTED' : 'DUSKPORT IS YOURS',
    kind === 'dead' ? 'Duskport General patched you up. 20% of your cash is gone.'
      : kind === 'arrested' ? 'DPD took your cash and your bought guns. 20% of your cash is gone.'
      : 'All 8 missions done. The city is yours, Kingpin.');
  const cx = W / 2;
  if (kind === 'complete') {
    ctx.fillStyle = '#cdd7ea';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(`Missions: 8/8   •   Cash: $${g.player.cash.toLocaleString()}   •   Respect: ${g.player.respect}`, W / 2, H * 0.38);
    button(ctx, 'freeroam', cx - 130, H * 0.5, 260, 52, 'KEEP PLAYING — FREE ROAM');
    button(ctx, 'title', cx - 130, H * 0.5 + 64, 260, 52, 'BACK TO TITLE');
  } else {
    button(ctx, 'respawn', cx - 130, H * 0.5, 260, 52, 'GET BACK OUT THERE');
  }
}
