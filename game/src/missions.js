// Duskport — missions: 8-story chain, step state machine, ambient robberies.
import { MISSIONS, SHOPS } from './config.js';
import { createCar } from './vehicles.js';
import { nearestRoadPoint } from './world.js';

export function createMissionState() {
  return {
    index: 0,            // mission in MISSIONS
    step: 0,             // step in mission.steps
    stepT: 0,            // per-step timer (rob progress, tail time)
    done: false,         // whole chain finished
    targetCar: null,     // courier van / Rico's car for tail/destroy steps
    failed: null,        // transient fail message
    failT: 0,
  };
}

export function currentMission(ms) {
  if (ms.done) return null;
  return MISSIONS[ms.index];
}

export function currentStep(ms) {
  const m = currentMission(ms);
  if (!m) return null;
  return m.steps[ms.step] || null;
}

export function objectiveOf(ms) {
  const step = currentStep(ms);
  if (!step) return null;
  if (step.kind === 'goto' || step.kind === 'rob') return { x: step.x, y: step.y, text: step.text };
  if (step.kind === 'loseWanted') {
    const z = { x: 300, y: 1850 }; // Palm Park — a cool-down zone
    return { x: z.x, y: z.y, text: step.text };
  }
  if (step.kind === 'tail' && ms.targetCar) return { x: ms.targetCar.x, y: ms.targetCar.y, text: step.text };
  if (step.kind === 'destroy' && ms.targetCar) return { x: ms.targetCar.x, y: ms.targetCar.y, text: step.text };
  return { x: 1250, y: 650, text: step.text };
}

// Spawn the step's target car when a tail/destroy step begins.
export function ensureStepTarget(ms, player, cars, rng) {
  const step = currentStep(ms);
  if (!step || (step.kind !== 'tail' && step.kind !== 'destroy')) return;
  if (ms.targetCar && !ms.targetCar.wrecked) return;
  const a = Math.atan2(player.y - 1000, player.x - 1600);
  const x = Math.max(120, Math.min(3000, player.x + Math.cos(a) * 420));
  const y = Math.max(120, Math.min(2280, player.y + Math.sin(a) * 420));
  const rp = nearestRoadPoint(x, y);
  const car = createCar(rp.x, rp.y, 0, step.kind === 'tail' ? '#e8e8e8' : '#c0392b', 'target');
  car.hp = step.kind === 'destroy' ? 120 : 200;
  car.maxHp = car.hp;
  car.road = 'v'; car.dir = 1; car.cruise = step.kind === 'tail' ? 200 : 260;
  ms.targetCar = car;
  cars.push(car);
}

// Advance one step; on mission end, pay out and advance the chain.
function completeStep(ms, game, events) {
  const m = currentMission(ms);
  ms.step += 1;
  ms.stepT = 0;
  events.push({ type: 'sfx', name: 'objective' });
  if (ms.step >= m.steps.length) {
    game.player.cash += m.reward;
    game.player.respect += m.respect;
    events.push({ type: 'missionComplete', mission: m });
    events.push({ type: 'sfx', name: 'mission' });
    ms.index += 1;
    ms.step = 0;
    ms.targetCar = null;
    if (ms.index >= MISSIONS.length) {
      ms.done = true;
      events.push({ type: 'gameComplete' });
    }
  }
}

// Fail the current step (death/arrest handled by caller): reset step state.
export function failStep(ms, reason) {
  ms.stepT = 0;
  ms.failed = reason;
  ms.failT = 3;
}

// Update the active mission step. `game` = {player, wanted, cars, world, events}.
export function updateMissions(ms, dt, game) {
  const { player, wanted, cars, events } = game;
  if (ms.failed) {
    ms.failT -= dt;
    if (ms.failT <= 0) ms.failed = null;
  }
  const m = currentMission(ms);
  if (!m) return;
  const step = currentStep(ms);
  if (!step) return;
  const px = player.mode === 'car' && player.car ? player.car.x : player.x;
  const py = player.mode === 'car' && player.car ? player.car.y : player.y;

  if (step.kind === 'goto') {
    const d = Math.hypot(px - step.x, py - step.y);
    if (d < step.r) completeStep(ms, game, events);
  } else if (step.kind === 'loseWanted') {
    if (wanted.stars === 0) completeStep(ms, game, events);
  } else if (step.kind === 'rob') {
    const d = Math.hypot(px - step.x, py - step.y);
    if (d < step.r) {
      ms.stepT += dt;
      if (ms.stepT >= 3) {
        player.cash += 300;
        events.push({ type: 'robbed', amount: 300 });
        completeStep(ms, game, events);
      }
    } else {
      ms.stepT = Math.max(0, ms.stepT - dt * 2);
    }
  } else if (step.kind === 'tail') {
    ensureStepTarget(ms, player, cars, game.rng);
    const t = ms.targetCar;
    if (t && !t.wrecked) {
      const d = Math.hypot(px - t.x, py - t.y);
      if (d < 340) {
        ms.stepT += dt;
        if (ms.stepT >= step.seconds) completeStep(ms, game, events);
      } else if (d > 460) {
        ms.stepT = Math.max(0, ms.stepT - dt * 2);
      }
      // Target van drives away along roads.
      t.x += Math.cos(t.angle) * t.cruise * dt;
      t.y += Math.sin(t.angle) * t.cruise * dt;
      t.angle += Math.sin(t.id * 3 + Date.now() / 3000) * 0.1 * dt;
    }
  } else if (step.kind === 'destroy') {
    ensureStepTarget(ms, player, cars, game.rng);
    const t = ms.targetCar;
    if (t) {
      if (t.wrecked) {
        const idx = cars.indexOf(t);
        if (idx >= 0) cars.splice(idx, 1);
        ms.targetCar = null;
        completeStep(ms, game, events);
      } else {
        // Rico flees from the player.
        const a = Math.atan2(t.y - py, t.x - px);
        t.angle = a;
        t.x += Math.cos(a) * t.cruise * dt;
        t.y += Math.sin(a) * t.cruise * dt;
      }
    }
  }
}

// Ambient robbery: any store marker can be robbed outside missions.
// Returns the rob progress 0..1 (0 when not robbing).
export function ambientRob(dt, player, events) {
  const stores = [
    { x: 1750, y: 1050 }, { x: 750, y: 1050 }, { x: 2750, y: 650 },
  ];
  const px = player.mode === 'car' && player.car ? player.car.x : player.x;
  const py = player.mode === 'car' && player.car ? player.car.y : player.y;
  for (const s of stores) {
    const d = Math.hypot(px - s.x, py - s.y);
    if (d < 80) {
      return { store: s, progress: -1 }; // marker present; mission logic handles the timer
    }
  }
  return null;
}

export function missionSave(ms) {
  return { index: ms.index, step: ms.step };
}

export function missionLoad(ms, data) {
  if (!data) return;
  ms.index = Math.min(data.index || 0, MISSIONS.length - 1);
  ms.step = data.step || 0;
  ms.stepT = 0;
  ms.targetCar = null;
  ms.done = ms.index >= MISSIONS.length;
}
