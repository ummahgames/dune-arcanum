export const WORLD = Object.freeze({ width: 480, height: 720, radius: 8, floor: 700, ceiling: 24, danger: 620, speed: 620, step: 1 / 120 });
const EPS = 1e-7;
export const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
export function reflect(vx, vy, nx, ny) {
  const dot = vx * nx + vy * ny;
  return { vx: vx - 2 * dot * nx, vy: vy - 2 * dot * ny };
}

function circleTime(x, y, vx, vy, cx, cy, radius, maxTime) {
  const dx = x - cx, dy = y - cy;
  const a = vx * vx + vy * vy;
  if (a < EPS) return null;
  const b = 2 * (dx * vx + dy * vy);
  const c = dx * dx + dy * dy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (t < -EPS || t > maxTime + EPS) return null;
  const hx = x + vx * Math.max(0, t) - cx, hy = y + vy * Math.max(0, t) - cy;
  const length = Math.hypot(hx, hy) || 1;
  const nx = hx / length, ny = hy / length;
  if (vx * nx + vy * ny >= -EPS) return null;
  return { t: Math.max(0, t), nx, ny };
}

// Exact circle against rectangle faces and rounded Minkowski corners.
export function sweepRect(ball, rect, maxTime) {
  const { x, y, vx, vy } = ball, r = ball.radius ?? WORLD.radius;
  const left = rect.x - rect.w / 2, right = rect.x + rect.w / 2;
  const top = rect.y - rect.h / 2, bottom = rect.y + rect.h / 2;
  const closestX = clamp(x, left, right), closestY = clamp(y, top, bottom);
  const distance = Math.hypot(x - closestX, y - closestY);
  if (distance < r - .001) {
    if (distance > EPS) return { t: 0, nx: (x - closestX) / distance, ny: (y - closestY) / distance, penetration: r - distance };
    const faces = [{ d: x - left, nx: -1, ny: 0 }, { d: right - x, nx: 1, ny: 0 }, { d: y - top, nx: 0, ny: -1 }, { d: bottom - y, nx: 0, ny: 1 }];
    faces.sort((a, b) => a.d - b.d);
    return { t: 0, nx: faces[0].nx, ny: faces[0].ny, penetration: r + faces[0].d };
  }
  let best = null;
  const accept = (t, nx, ny, valid) => {
    if (valid && t >= -EPS && t <= maxTime + EPS && (!best || t < best.t - EPS)) best = { t: Math.max(0, t), nx, ny };
  };
  if (vx > EPS) { const t = (left - r - x) / vx; const h = y + vy * t; accept(t, -1, 0, h >= top - EPS && h <= bottom + EPS); }
  if (vx < -EPS) { const t = (right + r - x) / vx; const h = y + vy * t; accept(t, 1, 0, h >= top - EPS && h <= bottom + EPS); }
  if (vy > EPS) { const t = (top - r - y) / vy; const h = x + vx * t; accept(t, 0, -1, h >= left - EPS && h <= right + EPS); }
  if (vy < -EPS) { const t = (bottom + r - y) / vy; const h = x + vx * t; accept(t, 0, 1, h >= left - EPS && h <= right + EPS); }
  for (const [cx, cy, sx, sy] of [[left, top, -1, -1], [right, top, 1, -1], [left, bottom, -1, 1], [right, bottom, 1, 1]]) {
    const hit = circleTime(x, y, vx, vy, cx, cy, r, maxTime);
    if (hit && hit.nx * sx >= -EPS && hit.ny * sy >= -EPS && (!best || hit.t < best.t - EPS)) best = hit;
  }
  return best;
}

export function sweepSegment(ball, segment, maxTime) {
  const { ax, ay, bx, by } = segment;
  const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
  if (!length) return null;
  const ux = dx / length, uy = dy / length, nx = -uy, ny = ux;
  const radius = (ball.radius ?? WORLD.radius) + (segment.radius ?? 4);
  const dist = (ball.x - ax) * nx + (ball.y - ay) * ny;
  const velocity = ball.vx * nx + ball.vy * ny;
  const projected = clamp((ball.x - ax) * ux + (ball.y - ay) * uy, 0, length);
  const cx = ax + projected * ux, cy = ay + projected * uy;
  const separation = Math.hypot(ball.x - cx, ball.y - cy);
  if (separation < radius - .001) {
    const direction = velocity > 0 ? -1 : 1;
    return { t: 0, nx: separation > EPS ? (ball.x - cx) / separation : nx * direction, ny: separation > EPS ? (ball.y - cy) / separation : ny * direction, penetration: radius - separation };
  }
  let best = null;
  if (Math.abs(velocity) > EPS) {
    for (const side of [-1, 1]) {
      const t = (side * radius - dist) / velocity;
      const along = (ball.x + ball.vx * t - ax) * ux + (ball.y + ball.vy * t - ay) * uy;
      if (t >= -EPS && t <= maxTime + EPS && along >= 0 && along <= length && velocity * side < 0) {
        if (!best || t < best.t) best = { t: Math.max(0, t), nx: nx * side, ny: ny * side };
      }
    }
  }
  for (const [cx, cy] of [[ax, ay], [bx, by]]) {
    const hit = circleTime(ball.x, ball.y, ball.vx, ball.vy, cx, cy, radius, maxTime);
    if (hit && (!best || hit.t < best.t - EPS)) best = hit;
  }
  return best;
}

export function fixtureSegment(fixture) {
  const x = fixture.x, y = fixture.y, h = 23;
  switch (fixture.orientation) {
    case 'vertical': return { ax: x, ay: y - h, bx: x, by: y + h, radius: 4 };
    case 'slash': return { ax: x - h, ay: y + h, bx: x + h, by: y - h, radius: 4 };
    case 'backslash': return { ax: x - h, ay: y - h, bx: x + h, by: y + h, radius: 4 };
    default: return { ax: x - h, ay: y, bx: x + h, by: y, radius: 4 };
  }
}

export function intersects(ball, rect) {
  const x = clamp(ball.x, rect.x - rect.w / 2, rect.x + rect.w / 2);
  const y = clamp(ball.y, rect.y - rect.h / 2, rect.y + rect.h / 2);
  return (ball.x - x) ** 2 + (ball.y - y) ** 2 < ((ball.radius ?? WORLD.radius) + 0.15) ** 2;
}

export function earliestEvent(ball, tiles, fixtures, maxTime) {
  let best = null;
  const accept = (hit, kind, entity = null) => {
    if (hit && hit.t >= -EPS && hit.t <= maxTime + EPS && (!best || hit.t < best.t - EPS)) best = { ...hit, kind, entity };
  };
  // Tie order is explicit: walls, floor, fixtures, tiles in stable creation order.
  if (ball.vx < -EPS) accept({ t: (WORLD.radius - ball.x) / ball.vx, nx: 1, ny: 0 }, 'wall');
  if (ball.vx > EPS) accept({ t: (WORLD.width - WORLD.radius - ball.x) / ball.vx, nx: -1, ny: 0 }, 'wall');
  if (ball.vy < -EPS) accept({ t: (WORLD.ceiling - ball.y) / ball.vy, nx: 0, ny: 1 }, 'wall');
  if (ball.vy > EPS) accept({ t: (WORLD.floor - ball.y) / ball.vy, nx: 0, ny: -1 }, 'floor');
  for (const fixture of fixtures) accept(sweepSegment(ball, fixtureSegment(fixture), maxTime), 'fixture', fixture);
  for (const tile of tiles) if (tile.alive && !ball.ignore?.includes(tile.id)) accept(sweepRect(ball, tile, maxTime), 'tile', tile);
  return best;
}
