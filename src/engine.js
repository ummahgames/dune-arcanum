import { WORLD, clamp, earliestEvent, intersects, reflect } from './physics.js';
import { generateEndlessWave } from './levels.js';

export function materialize(tiles, prefix = 'tile') {
  return tiles.map((tile, index) => ({ ...tile, id: `${prefix}-${tile.id ?? index}`, x: tile.col * 60 + 30, y: 84 + tile.row * 48, w: 54, h: 40, hp: tile.hp ?? 1, maxHp: tile.hp ?? 1, alive: true, flash: 0 }));
}

export function createGame(level, options = {}) {
  const tiles = materialize(level.tiles);
  return {
    version: 2, level: structuredClone(level), phase: 'aiming', phaseTime: 0, turn: 1, shots: 0, score: 0,
    tiles, fixtures: (level.fixtures ?? []).map((f, i) => ({ ...f, id: `mirror-${i}`, x: f.col * 60 + 30, y: 84 + f.row * 48 })),
    waves: structuredClone(level.waves ?? []), balls: [], launcher: { x: 240, y: WORLD.floor }, angle: 90,
    charges: { pierce: 0, echo: 0, lift: 0, ...level.abilityCharges }, armed: null, flightTime: 0, primaryLanding: null,
    assist: !!options.assist, usedAssist: !!options.assist, rewinds: 1, rewindUsed: 0, snapshot: null, round: 1,
    stats: { restored: 0, hits: 0, maxHits: 0, bankHits: 0, maxChain: 0, abilities: 0, recalls: 0, totalTargets: tiles.length + (level.waves ?? []).reduce((n, w) => n + w.tiles.length, 0) },
    shotStats: { hits: 0, breaks: 0, wall: false, split: false }, events: [], seed: level.seed ?? 1,
  };
}

export function checkpoint(game) {
  const copy = structuredClone(game);
  copy.events = []; copy.snapshot = null;
  return copy;
}
export function drainEvents(game) { const events = game.events; game.events = []; return events; }
function event(game, type, data = {}) { game.events.push({ type, ...data }); }

export function armAbility(game, ability) {
  if (game.phase !== 'aiming' || !game.charges[ability]) return false;
  game.armed = game.armed === ability ? null : ability;
  return true;
}

export function launch(game, angle = game.angle) {
  if (game.phase !== 'aiming') return false;
  game.snapshot = checkpoint(game);
  game.angle = clamp(angle, 12, 168);
  const theta = game.angle * Math.PI / 180;
  game.shots++; game.flightTime = 0; game.primaryLanding = null;
  game.shotStats = { hits: 0, breaks: 0, wall: false, split: false };
  const ability = game.armed;
  if (ability) { game.charges[ability]--; game.stats.abilities++; }
  if (ability === 'lift') {
    const amount = Math.min(Math.max(12, game.level.descent || 24), Math.max(0, Math.min(...game.tiles.filter(t => t.alive).map(t => t.y - 80))));
    for (const tile of game.tiles) if (tile.alive) tile.y -= amount;
    event(game, 'lift');
  }
  const makeBall = (dir, primary) => ({ x: game.launcher.x, y: WORLD.floor, vx: Math.cos(dir) * WORLD.speed, vy: -Math.sin(dir) * WORLD.speed, radius: WORLD.radius, active: true, primary, pierce: ability === 'pierce' ? 2 : 0, ignore: [], trail: [] });
  game.balls = [makeBall(theta, true)];
  if (ability === 'echo') { game.balls.push(makeBall(Math.PI - theta, false)); game.shotStats.split = true; }
  game.armed = null; game.phase = 'flight'; event(game, 'launch', { ability });
  return true;
}

function adjacent(a, b) {
  return (Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) <= 49) || (Math.abs(a.y - b.y) < 1 && Math.abs(a.x - b.x) <= 61);
}

export function damageTile(game, tile, amount = 1, visited = new Set()) {
  if (!tile.alive || visited.has(tile.id)) return;
  visited.add(tile.id);
  if (tile.type === 'core' && (game.tiles.some(t => t.alive && t.type !== 'core') || game.waves.length)) {
    event(game, 'locked', { x: tile.x, y: tile.y }); return;
  }
  tile.hp -= amount; tile.flash = .16; game.stats.hits++; game.shotStats.hits++;
  game.stats.maxHits = Math.max(game.stats.maxHits ?? 0, game.shotStats.hits);
  if (game.shotStats.wall) game.stats.bankHits++;
  event(game, 'hit', { x: tile.x, y: tile.y, material: tile.type, hp: tile.hp });
  if (tile.hp > 0) return;
  tile.alive = false;
  game.stats.restored++; game.shotStats.breaks++;
  game.score += 100 + Math.min(9, game.shotStats.breaks - 1) * 15;
  game.stats.maxChain = Math.max(game.stats.maxChain, game.shotStats.breaks);
  event(game, 'break', { x: tile.x, y: tile.y, material: tile.type, chain: game.shotStats.breaks });
  if (tile.type === 'linked') {
    for (const neighbor of game.tiles) if (neighbor.alive && neighbor.type === 'linked' && neighbor.group === tile.group && adjacent(tile, neighbor)) {
      event(game, 'link', { x: tile.x, y: tile.y, tx: neighbor.x, ty: neighbor.y });
      damageTile(game, neighbor, 1, visited);
    }
  }
  if (tile.type === 'seal') {
    event(game, 'seal', { x: tile.x, y: tile.y });
    for (const neighbor of game.tiles) if (neighbor.alive && adjacent(tile, neighbor)) damageTile(game, neighbor, 1, visited);
  }
}

function finishFlight(game) {
  game.launcher.x = clamp(game.primaryLanding ?? game.balls[0]?.x ?? game.launcher.x, WORLD.radius, WORLD.width - WORLD.radius);
  game.balls = []; game.phaseTime = .48; game.phase = 'resolving';
  event(game, 'resolve', { breaks: game.shotStats.breaks });
}

export function recall(game, automatic = false) {
  if (game.phase !== 'flight') return false;
  game.primaryLanding ??= game.balls.find(b => b.primary)?.x ?? game.launcher.x;
  if (!automatic) game.stats.recalls++;
  for (const ball of game.balls) ball.active = false;
  event(game, 'recall', { automatic }); finishFlight(game); return true;
}

function applyPressure(game) {
  const alive = game.tiles.filter(t => t.alive);
  if (!alive.length && !game.waves.length && !game.level.endless) {
    game.phase = 'victory'; event(game, 'victory'); return;
  }
  game.turn++;
  if (alive.length) {
    const descent = (game.level.descent ?? 0) * (game.assist ? .65 : 1);
    for (const tile of alive) { tile.previousY = tile.y; tile.y += descent; }
  }
  if (alive.some(tile => tile.y + tile.h / 2 >= WORLD.danger)) {
    game.phase = 'defeat'; event(game, 'defeat'); return;
  }
  const waveLimit = !alive.length && game.waves.length ? Math.max(game.shots, Math.min(...game.waves.map(w => w.turn))) : game.shots;
  const ready = game.waves.filter(w => w.turn <= waveLimit);
  game.waves = game.waves.filter(w => w.turn > waveLimit);
  for (const wave of ready) {
    const batch = materialize(wave.tiles, `wave-${wave.turn}`);
    // If a scripted wave is blocked, defer it rather than overlap existing targets.
    const blocked = batch.some(newTile => game.tiles.some(t => t.alive && Math.abs(t.x - newTile.x) < 54 && Math.abs(t.y - newTile.y) < 40));
    if (blocked) { game.waves.push({ ...wave, turn: game.shots + 1 }); continue; }
    game.tiles.push(...batch); event(game, 'wave');
  }
  if (game.level.endless && (!alive.length || game.turn % 4 === 0)) {
    game.round++;
    const descriptors = generateEndlessWave(game.round, game.seed);
    const batch = materialize(descriptors, `endless-${game.round}`);
    const safe = batch.filter(n => !game.tiles.some(t => t.alive && Math.abs(t.x - n.x) < 54 && Math.abs(t.y - n.y) < 40) && !game.fixtures.some(f => Math.abs(f.x - n.x) < 50 && Math.abs(f.y - n.y) < 42));
    game.tiles.push(...safe); game.stats.totalTargets += safe.length;
    if (game.round % 3 === 0) { game.charges.pierce++; event(game, 'reward', { ability: 'pierce' }); }
    event(game, 'wave');
  }
  game.phase = 'descent'; game.phaseTime = .34;
  event(game, 'descent');
}

export function stepGame(game, dt = WORLD.step) {
  for (const tile of game.tiles) tile.flash = Math.max(0, (tile.flash ?? 0) - dt);
  if (game.phase === 'resolving' || game.phase === 'descent') {
    game.phaseTime -= dt;
    if (game.phaseTime <= 0) {
      if (game.phase === 'resolving') applyPressure(game);
      else { game.phase = 'aiming'; game.tiles = game.tiles.filter(t => t.alive); for (const tile of game.tiles) delete tile.previousY; event(game, 'ready'); }
    }
    return;
  }
  if (game.phase !== 'flight') return;
  game.flightTime += dt;
  if (game.flightTime >= 15) { recall(game, true); return; }
  // Slice the array: any prism echo starts moving on the next simulation step.
  for (const ball of [...game.balls]) {
    if (!ball.active) continue;
    ball.ignore = ball.ignore.filter(id => { const tile = game.tiles.find(t => t.id === id); return tile?.alive && intersects(ball, tile); });
    let remaining = dt, count = 0;
    while (remaining > 1e-7 && count++ < 12 && ball.active) {
      const hit = earliestEvent(ball, game.tiles, game.fixtures, remaining);
      if (!hit) { ball.x += ball.vx * remaining; ball.y += ball.vy * remaining; break; }
      ball.x += ball.vx * hit.t; ball.y += ball.vy * hit.t; remaining -= hit.t;
      if (hit.kind === 'floor') {
        ball.active = false; ball.y = WORLD.floor;
        if (ball.primary) game.primaryLanding = clamp(ball.x, WORLD.radius, WORLD.width - WORLD.radius);
        event(game, 'land', { x: ball.x, primary: ball.primary }); break;
      }
      if (hit.kind === 'tile') {
        const tile = hit.entity;
        const wasAlive = tile.alive;
        damageTile(game, tile);
        if (tile.type === 'prism' && wasAlive && !game.shotStats.split) {
          game.shotStats.split = true;
          const speed = Math.hypot(ball.vx, ball.vy), angle = Math.atan2(ball.vy, ball.vx) + .46;
          game.balls.push({ ...ball, primary: false, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, pierce: 0, ignore: [tile.id], trail: [] });
          event(game, 'prism', { x: tile.x, y: tile.y });
        }
        if (ball.pierce > 0 && tile.type !== 'core') {
          ball.pierce--; ball.ignore.push(tile.id);
          const speed = Math.hypot(ball.vx, ball.vy);
          ball.x += ball.vx / speed * .05; ball.y += ball.vy / speed * .05;
          continue;
        }
      }
      if (hit.kind === 'wall' || hit.kind === 'fixture') {
        game.shotStats.wall = true;
        if (hit.kind === 'fixture') event(game, 'mirror', { x: ball.x, y: ball.y });
      }
      if (!hit.penetration || ball.vx * hit.nx + ball.vy * hit.ny < 0) Object.assign(ball, reflect(ball.vx, ball.vy, hit.nx, hit.ny));
      ball.x += hit.nx * ((hit.penetration ?? 0) + .025); ball.y += hit.ny * ((hit.penetration ?? 0) + .025);
    }
    ball.x = clamp(ball.x, WORLD.radius, WORLD.width - WORLD.radius);
    ball.y = Math.max(WORLD.ceiling, ball.y);
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 12) ball.trail.shift();
  }
  if (game.balls.every(b => !b.active)) finishFlight(game);
}

export function rewind(game) {
  if (!game.snapshot || !game.rewinds || !['aiming', 'defeat', 'resolving', 'descent'].includes(game.phase)) return null;
  const restored = structuredClone(game.snapshot);
  restored.rewinds = game.rewinds - 1; restored.rewindUsed = game.rewindUsed + 1;
  restored.phase = 'aiming'; restored.events = [{ type: 'rewind' }]; restored.snapshot = null;
  return restored;
}

export function starsFor(game) {
  if (game.phase !== 'victory') return [false, false, false];
  const craft = game.level.craft ?? { kind: 'noAbility' };
  const achieved = craft.kind === 'bank' ? game.stats.bankHits >= (craft.target ?? 1)
    : craft.kind === 'chain' ? game.stats.maxChain >= (craft.target ?? 3)
      : craft.kind === 'hits' ? (game.stats.maxHits ?? 0) >= (craft.target ?? 1) : game.stats.abilities === 0;
  return [true, game.shots <= game.level.par, achieved];
}

export function buildPreview(game, angle = game.angle, maxBounces = 3) {
  if (game.phase !== 'aiming') return { points: [], contacts: [], targetIds: [] };
  const copy = checkpoint(game); copy.events = [];
  const theta = clamp(angle, 12, 168) * Math.PI / 180;
  if (game.armed === 'lift') { const amount = Math.min(Math.max(12, game.level.descent || 24), Math.max(0, Math.min(...copy.tiles.filter(t => t.alive).map(t => t.y - 80)))); for (const tile of copy.tiles) if (tile.alive) tile.y -= amount; }
  const ball = { x: game.launcher.x, y: WORLD.floor, vx: Math.cos(theta) * WORLD.speed, vy: -Math.sin(theta) * WORLD.speed, radius: WORLD.radius, pierce: game.armed === 'pierce' ? 2 : 0, ignore: [] };
  const points = [{ x: ball.x, y: ball.y }], contacts = [], targetIds = [];
  for (let i = 0; i < maxBounces + 2; i++) {
    const hit = earliestEvent(ball, copy.tiles, copy.fixtures, 3);
    if (!hit) { points.push({ x: ball.x + ball.vx * .65, y: ball.y + ball.vy * .65 }); break; }
    ball.x += ball.vx * hit.t; ball.y += ball.vy * hit.t;
    points.push({ x: ball.x, y: ball.y }); contacts.push({ ...points.at(-1), kind: hit.kind });
    if (hit.kind === 'floor') break;
    if (hit.kind === 'tile') {
      targetIds.push(hit.entity.id); damageTile(copy, hit.entity);
      // A split is genuinely divergent, so end the main guide at the prism.
      if (hit.entity.type === 'prism') break;
      if (ball.pierce > 0 && hit.entity.type !== 'core') {
        ball.pierce--; ball.ignore.push(hit.entity.id);
        ball.x += ball.vx / WORLD.speed * .05; ball.y += ball.vy / WORLD.speed * .05; continue;
      }
    }
    if (!hit.penetration || ball.vx * hit.nx + ball.vy * hit.ny < 0) Object.assign(ball, reflect(ball.vx, ball.vy, hit.nx, hit.ny));
    ball.x += hit.nx * ((hit.penetration ?? 0) + .025); ball.y += hit.ny * ((hit.penetration ?? 0) + .025);
    ball.ignore = [];
    if (contacts.length >= maxBounces) break;
  }
  return { points, contacts, targetIds };
}
