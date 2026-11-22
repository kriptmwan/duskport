// Duskport — input: keyboard + mouse with per-frame edge detection.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys pressed since last consume
  let mouseX = 0, mouseY = 0, mouseDown = false, mousePressed = false;
  let anyGesture = false;

  function markGesture() { anyGesture = true; }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
    markGesture();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  });
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouseDown = true; mousePressed = true; markGesture(); }
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    down(k) { return keys.has(k); },
    wasPressed(k) { return pressed.has(k); },
    consumePressed() { pressed.clear(); mousePressed = false; },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown, pressed: mousePressed }; },
    hadGesture() { return anyGesture; },
    clearGesture() { anyGesture = false; },
    axis() {
      let x = 0, y = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) x += 1;
      if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
  };
}
