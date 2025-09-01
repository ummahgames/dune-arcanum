(async function() {
// Dune Arcanum — Brick Breaker (No Paddle) Prototype
// Static HTML/JS/CSS; drop on any simple server. Uses PixiJS for WebGL rendering.

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */
const CONFIG = {
  world: { width: 900, height: 1600 },     // logical units, origin at bottom-left (we invert Y)
  grid:  { cols: 10, cellH: 100, padding: 6 },
  descent: { rowStep: 42, spawnEveryTurns: 1, dangerBand: 120 }, // Reduced from 84 to 42 for slower descent
  ball: { radius: 18, v0: 1100, vMax: 1600, landSpeed: 120 },
  aim:  { previewBounces: 3, clampDegMin: 10, clampDegMax: 170 },
  difficulty: { hpMin: 1, hpMax: 4, reflectorChance: 0.12 },
  timescale: 1.0,
};

/* -------------------------------------------------------------------------- */
/* Boot PIXI                                                                  */
/* -------------------------------------------------------------------------- */
const stageEl = document.getElementById('stage');
const app = new PIXI.Application();
await app.init({
  width: Math.min(window.innerWidth, window.innerHeight/16*9),
  height: Math.min(window.innerHeight, window.innerWidth/9*16),
  antialias: true, backgroundAlpha: 0, resolution: window.devicePixelRatio || 1,
});
stageEl.appendChild(app.canvas);
app.canvas.classList.add('canvas-frame');

// Fit world -> canvas while keeping 9:16 staging box
const W = CONFIG.world.width, H = CONFIG.world.height;

// Root layers
const root = new PIXI.Container();
app.stage.addChild(root);

// Background layer
const bg = new PIXI.Container();
root.addChild(bg);

// World container (origin bottom-left by flipping Y)
const world = new PIXI.Container();
world.position.set(0, app.renderer.height);
world.scale.set(app.renderer.width / W, -app.renderer.height / H); // pixel <-> world mapping
root.addChild(world);

// UI overlay (non-flipped)
const ui = new PIXI.Container();
root.addChild(ui);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const hudScore = document.getElementById('score');
const hudTurn = document.getElementById('turn');
const btnFF = document.getElementById('ffwd');
const btnMute = document.getElementById('mute');

let AUDIO_ENABLED = true;
btnMute.addEventListener('click', ()=>{ AUDIO_ENABLED = !AUDIO_ENABLED; btnMute.textContent = AUDIO_ENABLED ? "🔈" : "🔇"; });

btnFF.addEventListener('click', ()=> toggleFastForward());
window.addEventListener('keydown', (e)=>{
  if (e.code === 'Space') { e.preventDefault(); toggleFastForward(); }
});
function toggleFastForward(){
  CONFIG.timescale = (CONFIG.timescale === 1 ? 3 : 1);
  btnFF.style.transform = CONFIG.timescale === 3 ? "scale(1.08)" : "scale(1.0)";
  btnFF.style.filter = CONFIG.timescale === 3 ? "brightness(1.15)" : "none";
}

function lerp(a,b,t){ return a + (b-a)*t; }
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function length(vx,vy){ return Math.hypot(vx,vy); }
function norm(x,y){ const L = Math.hypot(x,y)||1; return [x/L, y/L]; }
function reflect(vx,vy, nx,ny){ const dot = vx*nx + vy*ny; return [vx - 2*dot*nx, vy - 2*dot*ny]; }
function sign(x){ return x<0?-1:x>0?1:0; }

/* -------------------------------------------------------------------------- */
/* Background: dunes, moon, minarets, shimmer                                 */
/* -------------------------------------------------------------------------- */
function makeBackground(){
  // Draw on a RenderTexture using Canvas-like API via PIXI.Graphics
  const g = new PIXI.Graphics();
  const sandColors = [0x8e5b2a, 0xa86d37, 0xc3864b, 0xdb9a5b, 0xf0c089];
  const skyTop = 0x603913, skyBot = 0xa35f2b;
  // Sky gradient
  const sky = new PIXI.Graphics();
  const skyRect = new PIXI.Rectangle(0,0,app.renderer.width,app.renderer.height);
  const skyTex = gradientTexture(app.renderer.width, app.renderer.height, skyTop, skyBot);
  const skySpr = new PIXI.Sprite(skyTex);
  skySpr.width = app.renderer.width; skySpr.height = app.renderer.height;
  bg.addChild(skySpr);

  // Dunes as layered bezier shapes (non-flipped screen space)
  const dunes = new PIXI.Container(); bg.addChild(dunes);
  function dune(y, amp, color, alpha){
    const gr = new PIXI.Graphics().beginFill(color, alpha);
    gr.moveTo(0, y);
    const steps = 6;
    for(let i=0;i<=steps;i++){
      const x = (i/steps)*app.renderer.width;
      const yy = y + Math.sin((i+1)*0.9)*amp + (i%2?amp*0.5:-amp*0.3);
      gr.lineTo(x, yy);
    }
    gr.lineTo(app.renderer.width, app.renderer.height);
    gr.lineTo(0, app.renderer.height);
    gr.closePath(); gr.endFill(); dunes.addChild(gr);
  }
  dune(app.renderer.height*0.72, 50, sandColors[1], 1.0);
  dune(app.renderer.height*0.78, 60, sandColors[2], 0.9);
  dune(app.renderer.height*0.86, 70, sandColors[3], 0.8);

  // Moon
  const moon = new PIXI.Graphics();
  moon.beginFill(0xf7e7b2); moon.drawCircle(app.renderer.width*0.12, app.renderer.height*0.18, 34); moon.endFill();
  const cut = new PIXI.Graphics();
  cut.beginFill(0xa35f2b); cut.drawCircle(app.renderer.width*0.12+20, app.renderer.height*0.18-10, 36); cut.endFill();
  const moonContainer = new PIXI.Container(); moonContainer.addChild(moon); moonContainer.addChild(cut);
  const moonTex = app.renderer.generateTexture(moonContainer);
  const moonSpr = new PIXI.Sprite(moonTex); bg.addChild(moonSpr);

  // Minarets (simple silhouette)
  const min = new PIXI.Graphics();
  min.beginFill(0x6b3e1f, 0.6);
  const baseX = app.renderer.width*0.8;
  min.drawRect(baseX, app.renderer.height*0.35, 30, app.renderer.height*0.4);
  min.drawRect(baseX+60, app.renderer.height*0.43, 22, app.renderer.height*0.32);
  min.drawCircle(baseX+15, app.renderer.height*0.35, 14);
  min.drawCircle(baseX+71, app.renderer.height*0.43, 12);
  min.endFill();
  bg.addChild(min);

  // Subtle grain
  const noise = noiseTexture(256,256, 0.08);
  const grain = new PIXI.Sprite(noise);
  grain.width = app.renderer.width; grain.height = app.renderer.height;
  if (PIXI.BLEND_MODES && PIXI.BLEND_MODES.OVERLAY !== undefined) { grain.blendMode = PIXI.BLEND_MODES.OVERLAY; }
  grain.alpha = 0.35;
  bg.addChild(grain);

  // Heat shimmer near ground using displacement
  const dispTex = noiseTexture(256,256, 0.5);
  const dispSprite = new PIXI.Sprite(dispTex);
  if (PIXI.WRAP_MODES) { dispSprite.texture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT; }
  const dispFilter = (PIXI.filters && PIXI.filters.DisplacementFilter) ? new PIXI.filters.DisplacementFilter(dispSprite, 6) : null;
  dispSprite.position.set(0, app.renderer.height*0.80);
  dispSprite.scale.set(2, 1);
  bg.addChild(dispSprite);
  if (dispFilter){
    root.filters = [dispFilter];
    app.ticker.add((dt)=>{
      dispSprite.x += 0.2 * dt;
      dispSprite.y += 0.1 * dt;
      dispFilter.scale.y = 6 + Math.sin(perfNow()*0.001)*2;
    });
  }
}
function gradientTexture(w,h, top, bot){
  // create a small canvas gradient and upload as texture
  const c = document.createElement('canvas'); c.width = 1; c.height = h;
  const cx = c.getContext('2d');
  const g = cx.createLinearGradient(0,0,0,h);
  function hexToRgb(hex){ return [(hex>>16)&255, (hex>>8)&255, hex&255]; }
  const t = hexToRgb(top), b = hexToRgb(bot);
  g.addColorStop(0, `rgb(${t[0]},${t[1]},${t[2]})`);
  g.addColorStop(1, `rgb(${b[0]},${b[1]},${b[2]})`);
  cx.fillStyle = g; cx.fillRect(0,0,1,h);
  const tex = PIXI.Texture.from(c);
  if (PIXI.SCALE_MODES && PIXI.SCALE_MODES.LINEAR !== undefined) { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; }
  return tex;
}
function noiseTexture(w,h, strength=0.5){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d'); const img = cx.getImageData(0,0,w,h); const d=img.data;
  for(let i=0;i<d.length;i+=4){
    const v = (Math.random()*255)|0;
    d[i]=d[i+1]=d[i+2]=v; d[i+3]=(strength*255)|0;
  }
  cx.putImageData(img,0,0); const t = PIXI.Texture.from(c);
  if (PIXI.WRAP_MODES && PIXI.WRAP_MODES.REPEAT !== undefined) { t.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT; }
  return t;
}
function perfNow(){ return performance.now(); }

/* -------------------------------------------------------------------------- */
/* Bricks textures (procedural)                                               */
/* -------------------------------------------------------------------------- */
function brickTexture(size=96, hp=1, type="basic"){
  // Draw to offscreen canvas for crisp shapes then to texture
  const c = document.createElement('canvas'); c.width=c.height=size;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = true;

  // base ceramic gradient
  const g = x.createLinearGradient(0,0,0,size);
  const palette = [
    ['#8f5a2e','#b67c44','#d59a5c','#f2c987'],
    ['#8f5a2e','#ad703d','#c9894f','#efc178'],
    ['#7f4e27','#a26333','#c07e48','#e8b96f']
  ];
  const p = palette[hp % palette.length];
  g.addColorStop(0, p[0]); g.addColorStop(0.45, p[1]); g.addColorStop(1, p[2]);
  x.fillStyle = g; roundRect(x, 6,6,size-12,size-12,18, true);

  // inner inset
  const g2 = x.createLinearGradient(0,0,0,size);
  g2.addColorStop(0, 'rgba(255,255,255,0.08)');
  g2.addColorStop(1, 'rgba(0,0,0,0.22)');
  x.fillStyle = g2; roundRect(x, 12,12,size-24,size-24,14, true);

  // brass frame
  x.strokeStyle = '#caa76b'; x.lineWidth = 4;
  roundRect(x, 12,12,size-24,size-24,14, false);
  x.strokeStyle = '#8a6c3b'; x.lineWidth = 2;
  roundRect(x, 8,8,size-16,size-16,18, false);

  // star motif (kufic/geometry)
  x.save(); x.translate(size/2, size/2); x.rotate(Math.PI/10);
  const ringColor = 'rgba(255,255,255,0.28)';
  x.strokeStyle = ringColor; x.lineWidth = 2;
  for(let r=1; r<=hp; r++){
    starPolygon(x, 8, (size*0.12)*r + size*0.16, (size*0.06), 'rgba(255,255,255,0.07)');
  }
  // central star
  x.strokeStyle = '#e9d7a8'; x.lineWidth=2;
  starPolygon(x, 8, size*0.22, size*0.08, 'rgba(0,0,0,0)');
  x.restore();

  // reflective obsidian type
  if (type==="reflector"){
    const grd = x.createLinearGradient(0,0,size,size);
    grd.addColorStop(0,'#0d0b0a'); grd.addColorStop(1,'#2a1f1e');
    x.fillStyle = grd; roundRect(x, 14,14,size-28,size-28,12, true);
    x.globalCompositeOperation = 'lighter';
    x.fillStyle = 'rgba(80,160,200,0.15)';
    roundRect(x, 20,20,size-40,size-40,10, true);
    x.globalCompositeOperation = 'source-over';
  }

  // subtle grain
  x.globalAlpha = 0.2;
  for(let i=0;i<400;i++){
    x.fillStyle = 'rgba(255,255,255,'+(Math.random()*0.05)+')';
    x.fillRect(Math.random()*size, Math.random()*size, 1, 1);
  }
  x.globalAlpha = 1;

  const tex = PIXI.Texture.from(c);
  return tex;
}
function roundRect(ctx, x, y, w, h, r, fill){
  ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y, x+w,y+h, r);
  ctx.arcTo(x+w,y+h, x,y+h, r);
  ctx.arcTo(x,y+h, x,y, r);
  ctx.arcTo(x,y, x+w,y, r);
  if (fill) ctx.fill(); else ctx.stroke();
}
function starPolygon(ctx, points, R, r, fill){
  ctx.beginPath();
  for(let i=0;i<points*2;i++){
    const ang = i*Math.PI/points;
    const rad = i%2? r : R;
    const x = Math.cos(ang)*rad, y = Math.sin(ang)*rad;
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath(); ctx.stroke(); if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}

/* -------------------------------------------------------------------------- */
/* Ball texture & trail                                                       */
/* -------------------------------------------------------------------------- */
function ballTexture(R=20){
  const c = document.createElement('canvas'); c.width=c.height=R*2+8;
  const x = c.getContext('2d'); x.translate(c.width/2, c.height/2);
  const grad = x.createRadialGradient(0,0,R*0.3, 0,0,R);
  grad.addColorStop(0, '#f5e2b0'); grad.addColorStop(1, '#b98a55');
  x.fillStyle = grad; x.beginPath(); x.arc(0,0,R,0,Math.PI*2); x.fill();
  x.strokeStyle='#2e1a10'; x.lineWidth=2; x.stroke();
  x.rotate(Math.PI/10);
  x.strokeStyle = 'rgba(40,20,10,0.6)'; x.lineWidth=2;
  starPolygon(x, 8, R*0.6, R*0.24, 'rgba(255,255,255,0.08)');
  return PIXI.Texture.from(c);
}

/* -------------------------------------------------------------------------- */
/* ECS-ish structures                                                         */
/* -------------------------------------------------------------------------- */
let state = { turn:1, score:0, phase:"aiming", timescale:1 };
const bricks = [];
let ball = { x: W/2, y: 200, vx: 0, vy: 0, radius: CONFIG.ball.radius, sprite: null, active:false };

// Containers (in world coords)
const layerBricks = new PIXI.Container(); world.addChild(layerBricks);
const layerBall = new PIXI.Container(); world.addChild(layerBall);
const layerAim = new PIXI.Container(); world.addChild(layerAim);
const layerFX  = new PIXI.Container(); world.addChild(layerFX);

// Make visuals
makeBackground();

const texBall = ballTexture(CONFIG.ball.radius);
const sprBall = new PIXI.Sprite(texBall);
sprBall.anchor.set(0.5); sprBall.position.set(ball.x, ball.y);
sprBall.zIndex = 10;
layerBall.addChild(sprBall);
ball.sprite = sprBall;

// Trail using blur
const trail = new PIXI.Graphics();
layerBall.addChild(trail);
let blurFilter = null;
if (PIXI.filters && PIXI.filters.KawaseBlurFilter){
  blurFilter = new PIXI.filters.KawaseBlurFilter(3, 2);
  trail.filters = [blurFilter];
}

// Brick textures cache
const BRICK_TEX = {
  hp1: brickTexture(140,1,"basic"),
  hp2: brickTexture(140,2,"basic"),
  hp3: brickTexture(140,3,"basic"),
  hp4: brickTexture(140,4,"basic"),
  reflector: brickTexture(140,1,"reflector"),
};

/* -------------------------------------------------------------------------- */
/* Grid & spawning                                                            */
/* -------------------------------------------------------------------------- */
const GRID = (()=>{
  const cols = CONFIG.grid.cols;
  const cellW = W/cols;
  const cellH = CONFIG.grid.cellH;
  const pad = CONFIG.grid.padding;
  return { cols, cellW, cellH, pad };
})();

function addBrick(col, row, type="basic", hp=1){
  const { cellW, cellH, pad } = GRID;
  const x = col * cellW + cellW/2;
  const y = H - (row * cellH + cellH/2 + 200); // start from near top
  const spr = new PIXI.Sprite(hp<=1?BRICK_TEX.hp1:hp===2?BRICK_TEX.hp2:hp===3?BRICK_TEX.hp3:BRICK_TEX.hp4);
  if (type==="reflector") spr.texture = BRICK_TEX.reflector;
  spr.anchor.set(0.5); spr.position.set(x,y);
  spr.width = cellW - pad; spr.height = cellH - pad;
  layerBricks.addChild(spr);
  bricks.push({ col,row, x, y, w:(cellW-pad), h:(cellH-pad), hp, type, sprite:spr, alive:true });
}

function spawnRowAtTop(){
  // choose contents - all blocks are 1 HP (disappear after one hit)
  for(let c=0;c<GRID.cols;c++){
    // Create more consistent patterns - fewer random gaps
    if (Math.random() < 0.12) continue; // Reduced from 0.16 to 0.12 for more consistent coverage
    const isRefl = Math.random() < CONFIG.difficulty.reflectorChance;
    // All blocks are 1 HP - they disappear after one hit
    const hp = 1;
    addBrick(c, 0, isRefl?"reflector":"basic", hp);
  }
  // push existing rows' row index (not needed strictly for positioning)
}

function initialLayout(){
  // Few rows - all blocks are 1 HP (disappear after one hit)
  for(let r=0;r<3;r++){
    for(let c=0;c<GRID.cols;c++){
      // Create more consistent patterns - fewer random gaps
      if (Math.random() < 0.15) continue; // Reduced from 0.2 to 0.15 for more bricks
      // All blocks are 1 HP - they disappear after one hit
      const hp = 1;
      addBrick(c, r, "basic", hp);
    }
  }
}
initialLayout();

/* -------------------------------------------------------------------------- */
/* Input & Aim                                                                */
/* -------------------------------------------------------------------------- */
let pointer = {x:0,y:0, down:false};
app.canvas.addEventListener('pointerdown', (e)=>{
  pointer.down = true; updatePointer(e);
});
app.canvas.addEventListener('pointermove', (e)=>{ updatePointer(e); });
app.canvas.addEventListener('pointerup', (e)=>{
  updatePointer(e); pointer.down = false;
  if (state.phase === "aiming"){
    const dir = aimDirection();
    launch(dir[0], dir[1]);
  }
});

function updatePointer(e){
  const rect = app.canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (app.renderer.width/rect.width);
  const sy = (e.clientY - rect.top) * (app.renderer.height/rect.height);
  // Convert to world bottom-left
  const wx = sx / (app.renderer.width/W);
  const wy = (app.renderer.height - sy) / (app.renderer.height/H);
  pointer.x = wx; pointer.y = wy;
}
function aimDirection(){
  let dx = pointer.x - ball.x, dy = pointer.y - ball.y;
  let [nx, ny] = norm(dx,dy);
  // Clamp to avoid shallow near-horizontal shots
  let ang = Math.atan2(ny, nx) * 180 / Math.PI;
  ang = clamp(ang, CONFIG.aim.clampDegMin, CONFIG.aim.clampDegMax);
  const rad = ang * Math.PI/180;
  return [Math.cos(rad), Math.sin(rad)];
}

/* -------------------------------------------------------------------------- */
/* Physics: swept AABB circle vs bricks & walls                               */
/* -------------------------------------------------------------------------- */
function earliestCollision(px,py, vx,vy, dt){
  // Returns {t, nx,ny, brick} or null
  let tMin = 1e9, hit=null;

  // Walls: x=0, x=W, y=H ceiling
  if (vx < 0){ const t = (CONFIG.ball.radius - px) / vx; if (t>=0 && t<=dt && t<tMin){ tMin=t; hit={t, nx:1, ny:0, brick:null} } }
  if (vx > 0){ const t = ((W - CONFIG.ball.radius) - px) / vx; if (t>=0 && t<=dt && t<tMin){ tMin=t; hit={t, nx:-1, ny:0, brick:null} } }
  if (vy > 0){ const t = ((H - CONFIG.ball.radius) - py) / vy; if (t>=0 && t<=dt && t<tMin){ tMin=t; hit={t, nx:0, ny:-1, brick:null} } }
  // Floor landing handled separately (no bounce)

  // Bricks - improved collision detection
  const r = CONFIG.ball.radius;
  for (let b of bricks){
    if (!b.alive) continue;
    
    // Check if ball is already inside brick (shouldn't happen but safety)
    if (px >= b.x - b.w/2 - r && px <= b.x + b.w/2 + r &&
        py >= b.y - b.h/2 - r && py <= b.y + b.h/2 + r) {
      continue;
    }
    
    const x1 = b.x - b.w/2 - r, y1 = b.y - b.h/2 - r;
    const x2 = b.x + b.w/2 + r, y2 = b.y + b.h/2 + r;
    
    // Handle zero velocity components
    if (Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6) continue;
    
    const tx1 = (x1 - px) / (vx||1e-12);
    const tx2 = (x2 - px) / (vx||1e-12);
    const ty1 = (y1 - py) / (vy||1e-12);
    const ty2 = (y2 - py) / (vy||1e-12);
    
    const tEntry = Math.max(Math.min(tx1,tx2), Math.min(ty1,ty2));
    const tExit  = Math.min(Math.max(tx1,tx2), Math.max(ty1,ty2));
    
    if (tEntry > tExit || tExit < 0 || tEntry > dt) continue;
    
    const t = Math.max(tEntry, 0);
    if (t < tMin){
      // Improved normal calculation based on which face was hit first
      let nx = 0, ny = 0;
      const hitX = px + vx * t;
      const hitY = py + vy * t;
      
      // Determine which face was hit by checking distances to edges
      const distToLeft = Math.abs(hitX - (b.x - b.w/2 - r));
      const distToRight = Math.abs(hitX - (b.x + b.w/2 + r));
      const distToTop = Math.abs(hitY - (b.y - b.h/2 - r));
      const distToBottom = Math.abs(hitY - (b.y + b.h/2 + r));
      
      // Find the minimum distance to determine which face was hit
      const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
      
      if (minDist === distToLeft) { nx = 1; ny = 0; }      // Left face
      else if (minDist === distToRight) { nx = -1; ny = 0; } // Right face
      else if (minDist === distToTop) { nx = 0; ny = 1; }    // Top face
      else { nx = 0; ny = -1; }                              // Bottom face
      
      tMin = t; hit = {t, nx, ny, brick: b};
    }
  }
  return hit;
}

/* -------------------------------------------------------------------------- */
/* Audio (simple WebAudio tones)                                              */
/* -------------------------------------------------------------------------- */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const actx = AudioCtx ? new AudioCtx() : null;
function playTone(freq=400, dur=0.06, type='sine', vol=0.03){
  if (!AUDIO_ENABLED || !actx) return;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  o.connect(g); g.connect(actx.destination);
  g.gain.value = vol;
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
  o.stop(actx.currentTime + dur);
}

/* -------------------------------------------------------------------------- */
/* Launch / Resolve / Descent                                                 */
/* -------------------------------------------------------------------------- */
function launch(nx, ny){
  ball.vx = nx * CONFIG.ball.v0;
  ball.vy = ny * CONFIG.ball.v0;
  state.phase = "inFlight";
  ball.active = true;
  playTone(420,0.05,'triangle',0.04);
  document.getElementById('overlay').style.display='none';
}

function beginDescentPhase(){
  // Move bricks down and maintain proper grid alignment
  for (let b of bricks){ 
    if (b.alive){ 
      // Move down by one full row height to maintain grid alignment
      b.y -= CONFIG.grid.cellH; 
      b.sprite.y = b.y; 
      // Update row index for proper tracking
      b.row += 1;
    } 
  }
  // Spawn new row at top
  if (state.turn % CONFIG.descent.spawnEveryTurns === 0) spawnRowAtTop();
  // Game over check
  for (let b of bricks){
    if (!b.alive) continue;
    if (b.y - b.h/2 <= 0){
      gameOver(); return;
    }
  }
  state.turn++; hudTurn.textContent = "Turn: " + state.turn;
  state.phase = "aiming"; ball.active=false;
}

function gameOver(){
  state.phase = "gameOver";
  const t = new PIXI.Text("GAME OVER",{fontFamily:'serif',fontSize:80,fill:0xffffff,dropShadow:true,dropShadowBlur:8,dropShadowDistance:0});
  t.anchor.set(0.5); t.position.set(app.renderer.width/2, app.renderer.height/2);
  ui.addChild(t);
  playTone(120,0.3,'sawtooth',0.05);
}

/* -------------------------------------------------------------------------- */
/* Update loop                                                                */
/* -------------------------------------------------------------------------- */
let prev = perfNow(), acc = 0;
const dtFixed = 1/120; // simulation step
app.ticker.add(() => {
  const now = perfNow(); let dt = (now - prev)/1000; prev = now;
  dt *= CONFIG.timescale;
  acc += dt;
  const maxSteps = 10;
  let steps=0;
  while (acc >= dtFixed && steps++ < maxSteps){
    update(dtFixed);
    acc -= dtFixed;
  }
  render();
});

function update(dt){
  if (state.phase === "inFlight"){
    // Trail only shows when ball is actively moving
    trail.clear();
    const speed = length(ball.vx, ball.vy);
    if (speed > 50 && ball.active){ // Only show trail when moving fast enough and active
      // Create smooth trail with proper alpha fading
      for(let i=0;i<8;i++){
        const t = i/8;
        const fadeAlpha = 0.4 * (1 - t * 0.9);
        const trailRadius = ball.radius * (1 - t * 0.7);
        const trailX = ball.x - ball.vx * 0.012 * i;
        const trailY = ball.y - ball.vy * 0.012 * i;
        
        trail.beginFill(0xf2dab0, fadeAlpha);
        trail.drawCircle(trailX, trailY, trailRadius);
        trail.endFill();
      }
    } else {
      // Ensure trail is completely hidden when not moving
      trail.clear();
    }

    // Process motion with swept collisions (limit multiple bounces within dt)
    let remaining = dt, safety=0;
    while (remaining > 1e-6 && safety++ < 5){
      // Floor landing?
      if (ball.vy < 0){
        const tLand = ((CONFIG.ball.radius) - ball.y) / ball.vy; // y=0+r
        if (tLand >= 0 && tLand <= remaining){
          ball.x += ball.vx * tLand; ball.y += ball.vy * tLand;
          // Landed
          ball.vx = 0; ball.vy = 0; ball.active=false; state.phase="landed";
          break;
        }
      }
      const hit = earliestCollision(ball.x, ball.y, ball.vx, ball.vy, remaining);
      if (!hit){
        ball.x += ball.vx * remaining; ball.y += ball.vy * remaining; remaining = 0; break;
      }else{
        // Move to impact
        ball.x += ball.vx * hit.t; ball.y += ball.vy * hit.t;
        // Brick interaction
        if (hit.brick){
          const b = hit.brick;
          if (!b.alive){ remaining -= hit.t; continue; }
          if (b.type === "reflector"){
            // reflect without damage and slight speed up
            [ball.vx, ball.vy] = reflect(ball.vx, ball.vy, hit.nx, hit.ny);
            const sp = length(ball.vx, ball.vy);
            const s2 = Math.min(CONFIG.ball.vMax, sp * 1.10);
            const [nx,ny] = norm(ball.vx, ball.vy);
            ball.vx = nx * s2; ball.vy = ny * s2;
            // visual ping
            pingAt(b.x, b.y, 0x99e9ff);
            playTone(820,0.05,'square',0.03);
          }else{
            // All blocks are 1 HP - they disappear immediately when hit
            b.alive=false;
            state.score += 10;
            hudScore.textContent = "Score: " + state.score;
            b.sprite.parent.removeChild(b.sprite);
            bricks.splice(bricks.indexOf(b),1);
            shatterAt(b.x, b.y);
            pingAt(ball.x, ball.y, 0xffe49a);
            playTone(520,0.04,'sine',0.03);
            // reflect
            [ball.vx, ball.vy] = reflect(ball.vx, ball.vy, hit.nx, hit.ny);
          }
        }else{
          // Wall bounce
          [ball.vx, ball.vy] = reflect(ball.vx, ball.vy, hit.nx, hit.ny);
        }
        // Nudge out
        const eps = 0.5;
        ball.x += hit.nx * eps; ball.y += hit.ny * eps;
        remaining -= hit.t;
      }
    }
    // If we transitioned to landed
    if (state.phase === "landed"){
      beginDescentPhase();
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Particles                                                                   */
/* -------------------------------------------------------------------------- */
function pingAt(x,y, color=0xffffff){
  const g = new PIXI.Graphics();
  g.lineStyle(3, color, 0.8);
  g.drawCircle(x,y, 10); g.endFill();
  layerFX.addChild(g);
  app.ticker.addOnce(()=>{
    let a=1, r=10;
    const id = app.ticker.add((d)=>{
      a *= 0.92; r += 3;
      g.alpha = a; g.scale.set(1 + (10-r)/80);
      g.clear(); g.lineStyle(2, color, a); g.drawCircle(x,y, r);
      if (a<0.05){ app.ticker.remove(id); layerFX.removeChild(g); }
    });
  });
}
function shatterAt(x,y){
  for(let i=0;i<12;i++){
    const p = new PIXI.Graphics();
    p.beginFill(0xf3d29a, 0.9); p.drawPolygon([0,0, 6,2, 2,6]); p.endFill();
    p.position.set(x,y);
    layerFX.addChild(p);
    const ang = Math.random()*Math.PI*2;
    const sp = 200 + Math.random()*200;
    let vx = Math.cos(ang)*sp, vy = Math.sin(ang)*sp;
    let life = 0.5 + Math.random()*0.4;
    const id = app.ticker.add((dt)=>{
      const dts = dt/60;
      p.x += vx*dts; p.y += vy*dts;
      vy -= 400*dts; // fake gravity in world coords (Y up)
      life -= dts;
      p.alpha = Math.max(0, life*1.2);
      if (life<=0){ app.ticker.remove(id); layerFX.removeChild(p); }
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Aim preview                                                                */
/* -------------------------------------------------------------------------- */
const aimLine = new PIXI.Graphics(); layerAim.addChild(aimLine);
function drawAim(){
  aimLine.clear();
  if (state.phase !== "aiming") return;
  const [dx,dy] = aimDirection();
  // simulate limited bounces
  let p = {x:ball.x, y:ball.y}; let v = {x:dx*1200, y:dy*1200};
  let bounces = CONFIG.aim.previewBounces;
  aimLine.lineStyle(4, 0xffffff, 0.8);
  aimLine.moveTo(p.x, p.y);
  for(let i=0;i<bounces;i++){
    const hit = earliestCollision(p.x, p.y, v.x, v.y, 2.0); // generous t
    if (!hit){ aimLine.lineTo(p.x + v.x*0.5, p.y + v.y*0.5); break; }
    const nx = hit.nx, ny = hit.ny;
    const t = hit.t;
    p.x += v.x * t; p.y += v.y * t;
    aimLine.lineTo(p.x, p.y);
    // draw star at bounce
    const star = new PIXI.Graphics();
    star.lineStyle(2, 0xfff4c2, 0.9); star.drawStar(p.x,p.y, 6, 16);
    layerAim.addChild(star);
    setTimeout(()=> layerAim.removeChild(star), 80);
    // reflect
    const rv = reflect(v.x, v.y, nx, ny);
    v.x = rv[0]; v.y = rv[1];
    // nudge out
    p.x += nx*1.0; p.y += ny*1.0;
  }
}

/* -------------------------------------------------------------------------- */
/* Render                                                                      */
/* -------------------------------------------------------------------------- */
function render(){
  // Sync sprite with ball pos
  sprBall.position.set(ball.x, ball.y);
  // Aim
  drawAim();
}

/* -------------------------------------------------------------------------- */
/* Start                                                                       */
/* -------------------------------------------------------------------------- */
spawnRowAtTop();
hudScore.textContent = "Score: 0";
hudTurn.textContent = "Turn: 1";

})();