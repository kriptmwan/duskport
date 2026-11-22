// Duskport — configuration: tuning, districts, weapons, upgrades, missions.
// All numbers are gameplay tuning; the world layout is generated in world.js.
export const WORLD = {
  width: 3200,
  height: 2400,
  seed: 20261123,
  roadWidth: 92,
  blockGap: 26,
};

export const DISTRICTS = [
  { name: 'Downtown',  x: 1100, y: 200,  w: 1100, h: 700,  wall: '#3d4a63', roof: '#54658a', win: '#ffd97a', label: '#8fa3c8' },
  { name: 'Old Town',  x: 100,  y: 200,  w: 900,  h: 700,  wall: '#6b4a35', roof: '#8a6248', win: '#ffe9b0', label: '#c9a582' },
  { name: 'Harbor',    x: 2200, y: 1500, w: 900,  h: 800,  wall: '#2e4a52', roof: '#3e6673', win: '#aee6ff', label: '#7fb8c9' },
  { name: 'Industrial',x: 2200, y: 200,  w: 900,  h: 700,  wall: '#4a4a42', roof: '#636355', win: '#e8e0a0', label: '#a8a888' },
  { name: 'The Palms', x: 100,  y: 1500, w: 900,  h: 800,  wall: '#4a5a38', roof: '#647a4a', win: '#ffe9b0', label: '#a8c48a' },
];

// Roads: vertical and horizontal centre lines. Blocks sit between them.
export const ROADS_X = [250, 750, 1250, 1750, 2250, 2750, 3050];
export const ROADS_Y = [250, 650, 1050, 1450, 1850, 2150];

export const PLAYER = {
  walkSpeed: 230,
  runSpeed: 300,
  radius: 14,
  hp: 100,
  arrestTime: 2.0,      // seconds a cop must touch the player on foot to arrest
  respawnCashLoss: 0.20,
};

export const WEAPONS = {
  pistol:  { name: 'P9 Pistol',   damage: 26, rate: 4.0,  mag: 12, reload: 0.9, spread: 0.05, bulletSpeed: 780, price: 0,   ammoPrice: 0,  range: 520 },
  smg:     { name: 'VK-9 SMG',    damage: 13, rate: 10.0, mag: 30, reload: 1.3, spread: 0.11, bulletSpeed: 860, price: 800, ammoPrice: 60, range: 480 },
  shotgun: { name: 'M12 Scatter', damage: 13, rate: 1.1,  mag: 6,  reload: 1.8, spread: 0.22, bulletSpeed: 640, price: 1200,ammoPrice: 90, range: 340, pellets: 5 },
};

export const CAR = {
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  grip: 3.2,
  radius: 20,
  hp: 100,
};

export const UPGRADES = {
  engine: [
    { name: 'Stock Engine',   price: 0,    topSpeed: 560 },
    { name: 'Tuned Engine',   price: 600,  topSpeed: 660 },
    { name: 'Race Engine',    price: 1500, topSpeed: 780 },
  ],
  armor: [
    { name: 'Stock Body',     price: 0,    hp: 100 },
    { name: 'Plated Body',    price: 700,  hp: 170 },
    { name: 'Armored Body',   price: 1600, hp: 260 },
  ],
};

export const WANTED = {
  evadeCooldown: 8,     // seconds without cop line-of-sight before stars start draining
  starDrain: 2.0,       // seconds per star drained while hidden
  evadeBonus: 50,       // cash bonus on full evade
  evadeRespect: 15,
  maxCops: [0, 2, 3, 4, 5, 6],
  copSpeed: [0, 300, 330, 360, 400, 440],
};

export const RESPECT_RANKS = [
  { name: 'Street',  at: 0 },
  { name: 'Hustler', at: 150 },
  { name: 'Runner',  at: 350 },
  { name: 'Boss',    at: 600 },
  { name: 'Kingpin', at: 850 },
];

export const MISSIONS = [
  { id: 1, name: 'Hot Wheels', giver: 'Mara Voss', type: 'escape',
    brief: 'You lifted the wrong car. Lose the cops, then get to Mara\u2019s garage.',
    reward: 250, respect: 40,
    steps: [
      { kind: 'loseWanted', text: 'Lose the cops — break line of sight!' },
      { kind: 'goto', x: 1250, y: 650, r: 90, text: 'Drive to Mara\u2019s garage' },
    ] },
  { id: 2, name: 'First Delivery', giver: 'Mara Voss', type: 'deliver',
    brief: 'Pick up the package at the Old Town corner, deliver it to the Harbor.',
    reward: 400, respect: 50,
    steps: [
      { kind: 'goto', x: 300, y: 650, r: 90, text: 'Pick up the package — Old Town' },
      { kind: 'goto', x: 2750, y: 1850, r: 90, text: 'Deliver to the Harbor docks' },
    ] },
  { id: 3, name: 'Store Run', giver: 'Mara Voss', type: 'rob',
    brief: 'The corner store on 5th keeps its till in the back. Take it. Don\u2019t get caught.',
    reward: 650, respect: 70,
    steps: [
      { kind: 'rob', x: 1750, y: 1050, r: 80, text: 'Rob the 5th Ave store (stand inside, hold position)' },
      { kind: 'loseWanted', text: 'Lose the heat!' },
      { kind: 'goto', x: 1250, y: 650, r: 90, text: 'Bring the cash to Mara\u2019s garage' },
    ] },
  { id: 4, name: 'The Courier', giver: 'Mara Voss', type: 'tail',
    brief: 'A courier van carries the good stuff. Tail it — don\u2019t spook it — then take the cargo.',
    reward: 800, respect: 90,
    steps: [
      { kind: 'tail', seconds: 10, text: 'Tail the courier van — stay close, stay calm' },
      { kind: 'goto', x: 2250, y: 1450, r: 100, text: 'Grab the cargo at the drop point' },
    ] },
  { id: 5, name: 'Harbor Lights', giver: 'Mara Voss', type: 'deliver',
    brief: 'Night run to the Harbor. The docks are crawling with patrols — keep it quiet.',
    reward: 900, respect: 100,
    steps: [
      { kind: 'goto', x: 750, y: 1850, r: 90, text: 'Pick up the crates — Palms warehouse' },
      { kind: 'goto', x: 3050, y: 2150, r: 90, text: 'Deliver to the Harbor pier' },
    ] },
  { id: 6, name: 'Wrecking Crew', giver: 'Mara Voss', type: 'destroy',
    brief: 'Rico\u2019s crew is muscling in. Total his ride and send the message.',
    reward: 1100, respect: 120,
    steps: [
      { kind: 'destroy', text: 'Destroy Rico\u2019s car — ram it or shoot it' },
      { kind: 'loseWanted', text: 'Lose the heat!' },
    ] },
  { id: 7, name: 'Payday', giver: 'Mara Voss', type: 'rob',
    brief: 'Two stores, one night, three stars if you\u2019re sloppy. Make it count.',
    reward: 1600, respect: 150,
    steps: [
      { kind: 'rob', x: 750, y: 1050, r: 80, text: 'Rob the Downtown store' },
      { kind: 'rob', x: 2750, y: 650, r: 80, text: 'Rob the Industrial store' },
      { kind: 'goto', x: 1250, y: 650, r: 90, text: 'Bring it all home to Mara' },
    ] },
  { id: 8, name: 'Kingpin\u2019s Call', giver: 'Mara Voss', type: 'deliver',
    brief: 'The last run. Four stars, the whole city watching. Deliver the goods to the Palms mansion.',
    reward: 2500, respect: 250,
    steps: [
      { kind: 'goto', x: 1750, y: 1450, r: 90, text: 'Pick up the final goods — Industrial' },
      { kind: 'goto', x: 300, y: 2150, r: 110, text: 'Deliver to the Palms mansion' },
    ] },
];

export const SHOPS = {
  garage: { x: 1250, y: 650, name: 'Mara\u2019s Garage' },
  gunshop: { x: 750, y: 650, name: 'Iron & Lead Guns' },
  hospital: { x: 1750, y: 650, name: 'Duskport General' },
  policeHQ: { x: 2250, y: 1050, name: 'DPD Central' },
};

// Cool-down zones: hiding here drains wanted faster (park + harbor).
export const COOLDOWN_ZONES = [
  { x: 300, y: 1850, w: 420, h: 320, name: 'Palm Park' },
  { x: 2750, y: 2150, w: 380, h: 260, name: 'Harbor Pier' },
];

export const TRAFFIC_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#e0e0e0', '#222222', '#16a085'];
export const COP_COLOR = '#1a3a8a';
export const PLAYER_COLOR = '#ffcf3f';
