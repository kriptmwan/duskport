// Duskport — audio: WebAudio synth radio (2 stations) + SFX. Nothing starts
// until the first user gesture (autoplay policy).
let ctx = null;
let master = null;
let radioTimer = null;
let station = 0; // 0 = synthwave, 1 = lo-fi
let step = 0;
let radioOn = true;

const STATIONS = [
  { name: 'NEON FM', bpm: 112, bass: [55, 0, 55, 0, 65.4, 0, 49, 0], lead: [220, 277, 330, 277] },
  { name: 'PALM LO-FI', bpm: 76, bass: [65.4, 0, 0, 82.4, 0, 0, 73.4, 0], lead: [330, 294, 262, 294] },
];

export function audioUnlocked() { return !!ctx; }
export function radioName() { return STATIONS[station].name; }
export function toggleRadio() { radioOn = !radioOn; return radioOn; }
export function nextStation() {
  station = (station + 1) % STATIONS.length;
  step = 0;
  return STATIONS[station].name;
}

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    startRadioLoop();
  } catch (e) {
    ctx = null;
  }
}

function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noiseBurst(dur, vol, lowpass = 1200) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = lowpass;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}

function startRadioLoop() {
  if (radioTimer) return;
  radioTimer = setInterval(() => {
    if (!ctx || !radioOn || ctx.state !== 'running') return;
    const st = STATIONS[station];
    const beat = 60 / st.bpm / 2; // 8th notes
    const bass = st.bass[step % st.bass.length];
    if (bass) tone(bass, beat * 0.9, 'sawtooth', 0.10);
    if (step % 2 === 0) tone(st.lead[(step / 2 | 0) % st.lead.length] * 2, beat * 0.8, 'triangle', 0.05);
    if (step % 4 === 2) noiseBurst(0.05, 0.06, 6000); // hat
    step++;
  }, 260);
}

export function playSfx(name, weapon) {
  if (!ctx) return;
  switch (name) {
    case 'shoot':
      if (weapon === 'shotgun') { noiseBurst(0.18, 0.5, 900); tone(90, 0.12, 'square', 0.2, 0, 40); }
      else if (weapon === 'smg') { noiseBurst(0.07, 0.3, 2400); }
      else { noiseBurst(0.1, 0.35, 1600); tone(160, 0.07, 'square', 0.12, 0, 60); }
      break;
    case 'crash': noiseBurst(0.25, 0.5, 700); tone(70, 0.2, 'sawtooth', 0.2, 0, 35); break;
    case 'hit': noiseBurst(0.08, 0.25, 2000); break;
    case 'hurt': tone(220, 0.15, 'sawtooth', 0.2, 0, 110); break;
    case 'down': tone(330, 0.3, 'triangle', 0.2, 0, 110); break;
    case 'explosion': noiseBurst(0.7, 0.7, 500); tone(60, 0.6, 'sine', 0.4, 0, 28); break;
    case 'siren': tone(660, 0.35, 'sine', 0.10, 0, 880); tone(880, 0.35, 'sine', 0.10, 0.35, 660); break;
    case 'objective': tone(523, 0.12, 'triangle', 0.2); tone(784, 0.18, 'triangle', 0.2, 0.12); break;
    case 'mission': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.22, i * 0.11)); break;
    case 'robbed': [392, 523].forEach((f, i) => tone(f, 0.12, 'square', 0.12, i * 0.09)); break;
    case 'evade': [784, 988].forEach((f, i) => tone(f, 0.14, 'triangle', 0.18, i * 0.1)); break;
    case 'buy': tone(880, 0.1, 'triangle', 0.2); tone(1175, 0.14, 'triangle', 0.2, 0.09); break;
    case 'deny': tone(160, 0.18, 'square', 0.15, 0, 110); break;
    default: break;
  }
}
