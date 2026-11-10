import type { MovementDirection } from "./movement.js";
import type { SimulationTrace } from "./simulation.js";
import type { Position } from "./world.js";

export type RevealedCell = "unknown" | "free" | "blocked" | "target";

export interface RevealedWorld {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly RevealedCell[];
}

const directionOffsets: Record<MovementDirection, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/**
 * Rebuilds the agent-visible grid using only recorded local observations and
 * optional public mission metadata. It intentionally never reads true-map
 * obstacles or target coordinates from the trace.
 */
export function reconstructRevealedWorld(trace: SimulationTrace, selectedStep: number): RevealedWorld {
  const { width, height } = trace.map;
  const cells: RevealedCell[] = Array.from({ length: width * height }, () => "unknown");
  setCell(cells, width, height, trace.initialPosition, "free");

  if (trace.publicMission?.target !== undefined) {
    setCell(cells, width, height, trace.publicMission.target, "target");
  }

  const stepsToReveal = Math.max(0, Math.min(selectedStep, trace.steps.length));
  for (const traceStep of trace.steps.slice(0, stepsToReveal)) {
    const { observation } = traceStep;
    setCell(cells, width, height, observation.robot, "free");

    for (const direction of Object.keys(directionOffsets) as MovementDirection[]) {
      const offset = directionOffsets[direction];
      const position = {
        x: observation.robot.x + offset.x,
        y: observation.robot.y + offset.y,
      };
      const contents = observation.neighbors[direction];
      if (contents === "boundary") {
        continue;
      }
      setCell(cells, width, height, position, contents === "obstacle"
        ? "blocked"
        : contents === "target"
          ? "target"
          : "free");
    }
  }

  return { width, height, cells };
}

/** Produces a self-contained HTML viewer that works by opening the file locally. */
export function createReplayHtml(trace: SimulationTrace, title: string): string {
  const serializedTrace = JSON.stringify(trace).replace(/</g, "\\u003c");
  const serializedTitle = JSON.stringify(title).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · WorldForge Replay</title>
<style>
  :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7fb; color: #182033; }
  body { margin: 0; padding: 28px; }
  main { max-width: 1100px; margin: auto; }
  h1 { margin: 0 0 6px; font-size: 1.65rem; } .subtitle, #status { color: #59647b; }
  .controls, .card { background: white; border: 1px solid #dfe4ef; border-radius: 12px; box-shadow: 0 2px 10px #1820330b; }
  .controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 14px; margin: 20px 0; }
  button, select { font: inherit; border: 1px solid #c9d1e0; background: white; color: #182033; border-radius: 7px; padding: 7px 11px; cursor: pointer; }
  button:hover { background: #f1f4fa; } button:disabled { opacity: .5; cursor: default; }
  input[type="range"] { flex: 1 1 260px; accent-color: #3768e8; }
  #counter { min-width: 82px; font-variant-numeric: tabular-nums; font-weight: 650; }
  .boards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px; }
  .card { padding: 16px; } h2 { font-size: 1rem; margin: 0 0 5px; } .note { font-size: .84rem; line-height: 1.35; color: #59647b; min-height: 35px; }
  .board { --cols: 1; --rows: 1; position: relative; display: grid; grid-template-columns: repeat(var(--cols), 1fr); grid-template-rows: repeat(var(--rows), 1fr); width: min(100%, 520px); aspect-ratio: var(--cols) / var(--rows); margin: 14px auto 0; border: 2px solid #8e9ab1; border-radius: 5px; overflow: hidden; background: #f2f4f8; }
  .cell { border-right: 1px solid #d9deea; border-bottom: 1px solid #d9deea; background: #fff; transition: background .15s ease; }
  .cell.visited { background: #e5efff; } .cell.obstacle, .cell.blocked { background: #3c4658; }
  .cell.target { background: #d9f6df; box-shadow: inset 0 0 0 2px #43a663; }
  .cell.unknown { background: repeating-linear-gradient(45deg, #e7eaf1, #e7eaf1 6px, #f3f4f8 6px, #f3f4f8 12px); }
  .robot { position: absolute; top: 0; left: 0; z-index: 2; width: calc(100% / var(--cols)); height: calc(100% / var(--rows)); padding: 15%; box-sizing: border-box; transition: transform .22s ease; pointer-events: none; }
  .robot::after { content: ""; display: block; width: 100%; height: 100%; border-radius: 50%; background: #3264d9; border: 2px solid white; box-sizing: border-box; box-shadow: 0 1px 4px #18203366; }
  .legend { display: flex; gap: 11px; flex-wrap: wrap; font-size: .8rem; color: #59647b; margin-top: 12px; } .key { display: inline-flex; align-items: center; gap: 4px; } .swatch { width: 13px; height: 13px; border: 1px solid #aeb7c8; border-radius: 2px; }
  code { color: #31446d; } @media (max-width: 600px) { body { padding: 16px; } }
</style>
</head>
<body>
<main>
  <h1 id="title"></h1>
  <div class="subtitle">Local, standalone replay. The right panel uses only recorded observations and public mission data.</div>
  <section class="controls">
    <button id="back" title="Previous step">◀ Step</button>
    <button id="play">Play</button>
    <button id="forward" title="Next step">Step ▶</button>
    <label>Speed <select id="speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
    <input id="timeline" type="range" min="0" value="0">
    <span id="counter"></span>
  </section>
  <div id="status"></div>
  <section class="boards">
    <article class="card"><h2>Actual world</h2><div class="note">Ground-truth obstacles and target, shown for replay inspection.</div><div id="actual" class="board"></div></article>
    <article class="card"><h2>Observed world</h2><div class="note">Unknown cells remain hidden. This is not a display of private agent memory.</div><div id="observed" class="board"></div></article>
  </section>
  <div class="legend"><span class="key"><i class="swatch" style="background:#3c4658"></i>obstacle / observed blocked</span><span class="key"><i class="swatch" style="background:#d9f6df"></i>target</span><span class="key"><i class="swatch" style="background:#e5efff"></i>visited</span><span class="key"><i class="swatch" style="background:#e7eaf1"></i>unknown</span><span class="key"><i class="swatch" style="background:#3264d9;border-radius:50%"></i>robot</span></div>
</main>
<script>
const trace = ${serializedTrace};
const replayTitle = ${serializedTitle};
const offsets = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
let frame = 0, timer = null;
const $ = (id) => document.getElementById(id);
const actual = $('actual'), observed = $('observed'), timeline = $('timeline');
$('title').textContent = replayTitle;
timeline.max = String(trace.steps.length);
function key(p) { return p.x + ',' + p.y; }
function index(p) { return p.y * trace.map.width + p.x; }
function inside(p) { return p.x >= 0 && p.x < trace.map.width && p.y >= 0 && p.y < trace.map.height; }
function setupBoard(board) {
  board.style.setProperty('--cols', trace.map.width); board.style.setProperty('--rows', trace.map.height);
  for (let i = 0; i < trace.map.width * trace.map.height; i++) { const cell = document.createElement('div'); cell.className = 'cell'; board.append(cell); }
  const robot = document.createElement('div'); robot.className = 'robot'; board.append(robot); return { board, cells:[...board.querySelectorAll('.cell')], robot };
}
const actualBoard = setupBoard(actual), observedBoard = setupBoard(observed);
function positionAt(selected) { return selected === 0 ? trace.initialPosition : trace.steps[selected - 1].positionAfter; }
function visitedAt(selected) { const visited = new Set([key(trace.initialPosition)]); for (const step of trace.steps.slice(0, selected)) { if (step.succeeded) visited.add(key(step.positionAfter)); } return visited; }
function revealAt(selected) {
  const cells = Array(trace.map.width * trace.map.height).fill('unknown');
  const set = (p, state) => { if (inside(p)) cells[index(p)] = state; };
  set(trace.initialPosition, 'free');
  if (trace.publicMission && trace.publicMission.target) set(trace.publicMission.target, 'target');
  for (const step of trace.steps.slice(0, selected)) {
    set(step.observation.robot, 'free');
    for (const direction of Object.keys(offsets)) { const p = { x: step.observation.robot.x + offsets[direction].x, y: step.observation.robot.y + offsets[direction].y }; const contents = step.observation.neighbors[direction]; if (contents !== 'boundary') set(p, contents === 'obstacle' ? 'blocked' : contents === 'target' ? 'target' : 'free'); }
  }
  return cells;
}
function moveRobot(robot, p) { robot.style.transform = 'translate(' + (p.x * 100) + '%, ' + (p.y * 100) + '%)'; }
function render() {
  const position = positionAt(frame), visited = visitedAt(frame), revealed = revealAt(frame), obstacleKeys = new Set(trace.map.obstacles.map(key));
  actualBoard.cells.forEach((cell, i) => { const p = {x: i % trace.map.width, y: Math.floor(i / trace.map.width)}; cell.className = 'cell' + (obstacleKeys.has(key(p)) ? ' obstacle' : key(p) === key(trace.map.target) ? ' target' : visited.has(key(p)) ? ' visited' : ''); });
  observedBoard.cells.forEach((cell, i) => { cell.className = 'cell ' + revealed[i] + (revealed[i] === 'free' && visited.has((i % trace.map.width) + ',' + Math.floor(i / trace.map.width)) ? ' visited' : ''); });
  moveRobot(actualBoard.robot, position); moveRobot(observedBoard.robot, position);
  timeline.value = String(frame); $('counter').textContent = 'Step ' + frame + ' / ' + trace.steps.length;
  const step = frame === 0 ? null : trace.steps[frame - 1];
  $('status').textContent = step ? ('Action: ' + step.action + ' · ' + (step.succeeded ? 'moved' : 'rejected: ' + step.reason) + ' · position (' + position.x + ', ' + position.y + ')') : ('Initial position (' + position.x + ', ' + position.y + ')');
  $('back').disabled = frame === 0; $('forward').disabled = frame === trace.steps.length;
  if (frame === trace.steps.length) $('status').textContent += ' · termination: ' + trace.termination;
}
function stop() { if (timer !== null) { clearInterval(timer); timer = null; } $('play').textContent = 'Play'; }
function play() { if (timer !== null) { stop(); return; } if (frame === trace.steps.length) frame = 0; const delay = 700 / Number($('speed').value); timer = setInterval(() => { if (frame === trace.steps.length) { stop(); return; } frame++; render(); }, delay); $('play').textContent = 'Pause'; render(); }
$('back').onclick = () => { stop(); frame--; render(); }; $('forward').onclick = () => { stop(); frame++; render(); }; $('play').onclick = play; timeline.oninput = () => { stop(); frame = Number(timeline.value); render(); }; $('speed').onchange = () => { if (timer !== null) { stop(); play(); } };
render();
</script>
</body>
</html>`;
}

function setCell(cells: RevealedCell[], width: number, height: number, position: Position, state: RevealedCell): void {
  if (position.x >= 0 && position.x < width && position.y >= 0 && position.y < height) {
    cells[position.y * width + position.x] = state;
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
