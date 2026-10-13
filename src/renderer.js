import { WORLD, fixtureSegment } from './physics.js';
import { buildPreview } from './engine.js';

export const MATERIALS = {
  ceramic: { color: '#4bb8ac', dark: '#165f64', label: 'Ceramic', detail: 'One hit restores this fragment.' },
  reinforced: { color: '#699acb', dark: '#264d80', label: 'Lapis', detail: 'The number shows hits remaining.' },
  linked: { color: '#c5b774', dark: '#696238', label: 'Constellation', detail: 'Breaking it sends damage to touching stars in its group.' },
  seal: { color: '#e4a46c', dark: '#96542f', label: 'Sand seal', detail: 'Breaking it damages the four neighboring cells.' },
  prism: { color: '#bb94d6', dark: '#624c8a', label: 'Prism', detail: 'One prism per shot creates a companion orb. The guide ends here.' },
  core: { color: '#f2d79a', dark: '#946d31', label: 'Atlas heart', detail: 'Restore every other fragment and wave to open the heart.' },
  mirror: { color: '#b9d3d4', dark: '#45686d', label: 'Mirror', detail: 'An anchored reflector. It never descends or needs clearing.' },
};
const PALETTES = ['#4bb8ac', '#699acb', '#bb94d6', '#e4c084'];
function rounded(ctx, x, y, w, h, r = 6) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function star(ctx, x, y, r, points = 8, inner = .55, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) { const a = rotation + i * Math.PI / points, rad = i % 2 ? r * inner : r; const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
  ctx.closePath();
}
export class BoardRenderer {
  constructor(canvas, settings) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.settings = settings; this.images = new Map(); this.effects = []; this.time = 0;
    for (const name of ['sand-gate', 'lapis-court', 'glass-observatory', 'atlas-vault', 'mosaic', 'orb']) { const img = new Image(); img.src = `assets/${name}.svg`; this.images.set(name, img); }
    this.preview = null; this.previewKey = ''; this.lastGame = null;
    this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio)); this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
    this.scale = this.canvas.width / WORLD.width;
  }
  coordinates(clientX, clientY) { const rect = this.canvas.getBoundingClientRect(); return { x: (clientX - rect.left) / rect.width * WORLD.width, y: (clientY - rect.top) / rect.height * WORLD.height }; }
  pick(game, x, y) { return game.tiles.find(t => t.alive && Math.abs(t.x - x) < t.w / 2 + 3 && Math.abs(t.y - y) < t.h / 2 + 3) ?? game.fixtures.find(f => Math.abs(f.x - x) < 27 && Math.abs(f.y - y) < 27); }
  effect(event) {
    const reduced = this.settings.reducedMotion;
    if (event.type === 'break' || event.type === 'seal') {
      const color = MATERIALS[event.material ?? 'seal']?.color ?? '#f2d79a';
      for (let i = 0; i < (reduced ? 3 : 10); i++) {
        const angle = Math.random() * Math.PI * 2, speed = 40 + Math.random() * 120;
        this.effects.push({ kind: 'shard', x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .55, maxLife: .55, color, size: 2 + Math.random() * 3 });
      }
      this.effects.push({ kind: 'ring', x: event.x, y: event.y, life: .45, maxLife: .45, color, size: event.type === 'seal' ? 55 : 28 });
      if (event.chain >= 3) this.effects.push({ kind: 'text', x: event.x, y: event.y - 24, life: .9, maxLife: .9, color: '#f6df9e', text: `${event.chain} linked` });
    } else if (event.type === 'link') this.effects.push({ kind: 'link', ...event, life: .35, maxLife: .35, color: '#ffe8a0' });
    else if (event.type === 'mirror' || event.type === 'locked') this.effects.push({ kind: 'ring', x: event.x, y: event.y, life: .25, maxLife: .25, color: event.type === 'locked' ? '#e7a36c' : '#bce8e4', size: 20 });
    if (this.effects.length > 160) this.effects.splice(0, this.effects.length - 160);
  }
  reset() { this.effects = []; this.previewKey = ''; this.preview = null; }
  update(dt) {
    this.time += dt;
    for (const e of this.effects) { e.life -= dt; if (e.kind === 'shard') { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 150 * dt; } if (e.kind === 'text' && !this.settings.reducedMotion) e.y -= dt * 15; }
    this.effects = this.effects.filter(e => e.life > 0);
  }
  draw(game, options = {}) {
    const c = this.ctx, width = this.canvas.width, height = this.canvas.height;
    if (!width || !height) return;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, width, height);
    c.setTransform(width / 480, 0, 0, height / 720, 0, 0);
    c.fillStyle = '#0c2630'; c.fillRect(0, 0, 480, 720);
    const bg = this.images.get(['sand-gate', 'lapis-court', 'glass-observatory', 'atlas-vault'][game.level.chapter] ?? 'sand-gate');
    if (bg?.complete && bg.naturalWidth) c.drawImage(bg, 0, 0, 480, 720);
    // A quiet scrim keeps scenery behind gameplay rather than competing with it.
    const scrim = c.createLinearGradient(0, 0, 0, 720); scrim.addColorStop(0, 'rgba(4,20,29,.12)'); scrim.addColorStop(.7, 'rgba(4,20,29,.3)'); scrim.addColorStop(1, 'rgba(4,20,29,.15)'); c.fillStyle = scrim; c.fillRect(0, 0, 480, 720);
    const mosaic = this.images.get('mosaic'), fraction = game.stats.restored / Math.max(1, game.stats.totalTargets);
    if (mosaic?.complete && mosaic.naturalWidth && fraction > 0) { c.save(); c.globalAlpha = .055 + fraction * .12; c.drawImage(mosaic, 0, 0, 480, 720); c.restore(); }
    c.save(); c.strokeStyle = 'rgba(177,209,205,.07)'; c.lineWidth = 1;
    for (let x = 30; x < 480; x += 60) { c.beginPath(); c.moveTo(x, 60); c.lineTo(x, 600); c.stroke(); }
    for (let y = 84; y < 610; y += 48) { c.beginPath(); c.moveTo(12, y); c.lineTo(468, y); c.stroke(); }
    c.restore();
    // Upcoming wave is deliberately subdued and has no collision until it enters.
    const wave = game.waves.reduce((a, b) => !a || b.turn < a.turn ? b : a, null);
    if (wave && wave.turn - game.turn <= 2) { c.save(); c.strokeStyle = '#d5d4a6'; c.globalAlpha = .24; c.setLineDash([3, 4]); for (const tile of wave.tiles) { rounded(c, tile.col * 60 + 10, 31, 40, 18, 4); c.stroke(); } c.restore(); }
    // Only visually connect stars that the actual rules consider neighbors.
    c.strokeStyle = 'rgba(231,217,157,.45)'; c.lineWidth = 1.5;
    const linked = game.tiles.filter(t => t.alive && t.type === 'linked');
    for (let i = 0; i < linked.length; i++) for (let j = i + 1; j < linked.length; j++) {
      const a = linked[i], b = linked[j];
      if (a.group === b.group && ((Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) <= 49) || (Math.abs(a.y - b.y) < 1 && Math.abs(a.x - b.x) <= 61))) { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
    }
    if (game.phase === 'aiming') {
      const key = `${game.level.id}:${game.turn}:${game.angle.toFixed(3)}:${game.armed}:${game.launcher.x}:${game.tiles.map(t => `${t.id},${t.hp},${t.y}`).join(';')}`;
      if (key !== this.previewKey || game !== this.lastGame) { this.preview = buildPreview(game, game.angle, game.assist ? 5 : 3); this.previewKey = key; }
    }
    for (const tile of game.tiles) if (tile.alive) this.drawTile(tile, game, this.preview?.targetIds?.[0] === tile.id && game.phase === 'aiming');
    for (const f of game.fixtures) this.drawMirror(f);
    this.drawDanger(game);
    if (game.phase === 'aiming' && !options.paused) this.drawPreview(this.preview);
    for (const ball of game.balls) if (ball.active) { this.drawTrail(ball); this.drawOrb(ball.x, ball.y, ball.primary ? 1 : .75, !!ball.pierce); }
    if (game.phase !== 'flight') this.drawOrb(game.launcher.x, WORLD.floor, 1, game.armed === 'pierce');
    if (game.phase === 'aiming') {
      c.save(); c.strokeStyle = game.armed ? '#eacb85' : 'rgba(168,227,216,.5)'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(game.launcher.x, WORLD.floor, 18 + (this.settings.reducedMotion ? 0 : Math.sin(this.time * 2) * 1.5), Math.PI, Math.PI * 2); c.stroke();
      c.restore();
    }
    this.drawEffects();
    c.strokeStyle = '#b18c58'; c.lineWidth = 1; c.strokeRect(5, 5, 470, 710);
    for (const [x, y, rotation] of [[16,16,0],[464,16,Math.PI/2],[464,704,Math.PI],[16,704,-Math.PI/2]]) { c.save(); c.translate(x,y); c.rotate(rotation); c.strokeStyle='#cfb077'; c.beginPath(); c.moveTo(0,18); c.lineTo(0,0); c.lineTo(18,0); c.stroke(); star(c,0,0,4,4); c.fillStyle='#cfb077'; c.fill(); c.restore(); }
    if (options.paused) { c.fillStyle = 'rgba(6,20,28,.5)'; c.fillRect(0,0,480,720); }
    this.lastGame = game;
  }
  drawTile(tile, game, selected) {
    const c = this.ctx, m = MATERIALS[tile.type] ?? MATERIALS.ceramic;
    const y = tile.previousY !== undefined && game.phase === 'descent' ? tile.previousY + (tile.y - tile.previousY) * (1 - Math.max(0, game.phaseTime) / .34) : tile.y;
    const x = tile.x - tile.w / 2, top = y - tile.h / 2;
    c.save();
    c.fillStyle = 'rgba(0,0,0,.22)'; rounded(c, x + 1, top + 3, tile.w, tile.h); c.fill();
    const gradient = c.createLinearGradient(x, top, x, top + tile.h); gradient.addColorStop(0, m.color); gradient.addColorStop(1, m.dark);
    c.fillStyle = this.settings.highContrast ? m.dark : gradient; rounded(c, x, top, tile.w, tile.h); c.fill();
    c.strokeStyle = selected ? '#fff4cc' : this.settings.highContrast ? '#fff2cd' : 'rgba(244,219,166,.7)'; c.lineWidth = selected ? 2.4 : 1; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.2)'; rounded(c,x+3,top+3,tile.w-6,tile.h-6,4); c.stroke();
    if (tile.flash > 0) { c.fillStyle = `rgba(255,247,214,${tile.flash * 2})`; rounded(c,x,top,tile.w,tile.h); c.fill(); }
    c.strokeStyle = '#fbefd1'; c.fillStyle = '#fbefd1'; c.lineWidth = 1.3;
    if (tile.type === 'prism') { c.beginPath(); c.moveTo(tile.x,y-13); c.lineTo(tile.x+15,y+11); c.lineTo(tile.x-15,y+11); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(tile.x,y-13); c.lineTo(tile.x,y+11); c.stroke(); }
    else if (tile.type === 'seal') { c.beginPath(); c.ellipse(tile.x,y+2,9,11,0,0,Math.PI*2); c.stroke(); c.beginPath(); c.moveTo(tile.x-5,y-9); c.lineTo(tile.x+5,y-9); c.moveTo(tile.x-4,y-12); c.lineTo(tile.x+4,y-12); c.stroke(); }
    else if (tile.type === 'core') { star(c,tile.x,y,15,8,.72,this.settings.reducedMotion ? -Math.PI/2 : this.time*.1); c.stroke(); c.beginPath(); c.arc(tile.x,y,7,0,Math.PI*2); c.stroke(); }
    else { star(c,tile.x - (tile.hp > 1 ? 5 : 0),y, tile.type === 'linked' ? 12 : 13, tile.type === 'linked' ? 4 : 8,.5); c.stroke(); if (tile.type === 'reinforced') { c.beginPath(); c.arc(tile.x-5,y,15,0,Math.PI*2); c.stroke(); } }
    if (tile.hp > 1) { c.font=`bold ${Math.min(28,Math.max(19,13/(this.canvas.clientWidth/480)))}px system-ui`; c.textAlign='center'; c.textBaseline='middle'; c.fillStyle='#fff8df'; c.shadowColor='#0a1d28'; c.shadowBlur=2; c.fillText(String(tile.hp),tile.x+15,y+1); c.shadowBlur=0; }
    if (tile.hp < tile.maxHp) { c.strokeStyle='rgba(9,25,35,.6)'; c.lineWidth=1.5; c.beginPath(); c.moveTo(x+4,top+3); c.lineTo(x+12,top+12); c.lineTo(x+9,top+22); c.stroke(); }
    if (game.level.descent && tile.y + tile.h / 2 + game.level.descent * (game.assist ? .65 : 1) >= WORLD.danger) { c.strokeStyle='#ffb197'; c.lineWidth=2; rounded(c,x-2,top-2,tile.w+4,tile.h+4,7); c.stroke(); }
    c.restore();
  }
  drawMirror(fixture) {
    const c=this.ctx,s=fixtureSegment(fixture); c.save();
    c.strokeStyle='#314951';c.lineWidth=12;c.lineCap='round';c.beginPath();c.moveTo(s.ax,s.ay);c.lineTo(s.bx,s.by);c.stroke();
    c.strokeStyle='#9ec8cc';c.lineWidth=7;c.stroke();c.strokeStyle='#eef6e9';c.lineWidth=1.5;c.stroke();
    for(const [x,y] of [[s.ax,s.ay],[s.bx,s.by]]){c.fillStyle='#a88451';c.beginPath();c.arc(x,y,4,0,Math.PI*2);c.fill();}c.restore();
  }
  drawDanger(game) {
    const c=this.ctx,nearest=game.tiles.filter(t=>t.alive).reduce((n,t)=>Math.min(n,WORLD.danger-t.y-t.h/2),999);
    const urgent=nearest<80;c.save();c.strokeStyle=urgent?'#e4977c':'rgba(194,174,127,.55)';c.lineWidth=1;c.setLineDash([8,7]);c.beginPath();c.moveTo(16,WORLD.danger);c.lineTo(464,WORLD.danger);c.stroke();c.setLineDash([]);
    c.fillStyle=urgent?'#ffc0a1':'#c5bd9c';c.font='10px system-ui';c.textAlign='left';c.fillText(game.level.descent ? 'BREACH LINE' : 'A QUIET CHAMBER',18,WORLD.danger+16);
    c.textAlign='right';c.fillStyle='#aac9c5';c.fillText(game.phase==='aiming'?(this.settings.tapAim?'TAP TO AIM · THEN SEND':'DRAG TO AIM · RELEASE TO SEND'):'',461,675);c.restore();
  }
  drawPreview(preview) {
    if(!preview?.points.length)return;const c=this.ctx;c.save();c.lineCap='round';
    for(let i=1;i<preview.points.length;i++){c.strokeStyle=i===1?'rgba(234,249,228,.85)':`rgba(185,225,214,${.5/(i*.65)})`;c.lineWidth=i===1?2:1.5;c.setLineDash(i===1?[3,7]:[3,8]);c.beginPath();c.moveTo(preview.points[i-1].x,preview.points[i-1].y);c.lineTo(preview.points[i].x,preview.points[i].y);c.stroke();}
    c.setLineDash([]);for(const [i,contact] of preview.contacts.entries()){c.globalAlpha=1/(i+1);c.fillStyle='#f4df9d';if(contact.kind==='floor'){c.beginPath();c.arc(contact.x,contact.y,12,Math.PI,Math.PI*2);c.stroke();}else{star(c,contact.x,contact.y,4,4);c.fill();}}c.restore();
  }
  drawTrail(ball) { if(this.settings.reducedMotion)return;const c=this.ctx;c.save();for(let i=0;i<ball.trail.length;i++){const p=ball.trail[i];c.globalAlpha=i/ball.trail.length*.32;c.fillStyle=ball.primary?'#f4e3b1':'#acbfee';c.beginPath();c.arc(p.x,p.y,2+i/ball.trail.length*4,0,Math.PI*2);c.fill();}c.restore(); }
  drawOrb(x,y,alpha=1,pierce=false){const c=this.ctx;c.save();c.globalAlpha=alpha;c.shadowColor=pierce?'#f1ac73':this.settings.orb==='lapis'?'#79b5fb':'#b5e6dd';c.shadowBlur=this.settings.reducedMotion?0:9;const colors={ivory:'#faeac1',lapis:'#9bc4f0',copper:'#f3b688',starlight:'#d9c5ff'};c.fillStyle=pierce?'#ffc17f':colors[this.settings.orb]??colors.ivory;c.strokeStyle='#132d35';c.lineWidth=2;c.beginPath();c.arc(x,y,8,0,Math.PI*2);c.fill();c.stroke();c.shadowBlur=0;c.strokeStyle='#7b683c';c.lineWidth=.8;star(c,x,y,5,4,.45);c.stroke();c.restore();}
  drawEffects(){const c=this.ctx;c.save();for(const e of this.effects){c.globalAlpha=Math.max(0,e.life/e.maxLife);c.fillStyle=e.color;c.strokeStyle=e.color;if(e.kind==='shard'){c.save();c.translate(e.x,e.y);c.rotate(e.life*5);c.fillRect(-e.size/2,-e.size/2,e.size,e.size);c.restore();}else if(e.kind==='ring'){c.lineWidth=1.5;c.beginPath();c.arc(e.x,e.y,e.size*(1-e.life/e.maxLife)+5,0,Math.PI*2);c.stroke();}else if(e.kind==='link'){c.lineWidth=3;c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.tx,e.ty);c.stroke();}else{c.font='bold 13px system-ui';c.textAlign='center';c.fillText(e.text,e.x,e.y);}}c.restore();}
}
