import { CHAPTERS, LEVELS, createDaily, createEndless, validateLevels } from './src/levels.js';
import { WORLD, clamp } from './src/physics.js';
import { createGame, launch, armAbility, stepGame, drainEvents, checkpoint, rewind, starsFor, recall } from './src/engine.js';
import { BoardRenderer, MATERIALS } from './src/renderer.js';
import { SaveStore } from './src/storage.js';
import { Soundscape } from './src/audio.js';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const store = new SaveStore();
const settings = store.profile.settings;
const sound = new Soundscape(settings);
let renderer;
try { renderer = new BoardRenderer($('gameCanvas'), settings); }
catch { $('menuView').innerHTML = '<div class="page-heading"><h1>Your canvas needs a moment.</h1><p>This browser could not create the game board. Try reloading or opening a current browser with Canvas enabled.</p><button class="button button-gold" onclick="location.reload()">Reload</button></div>'; throw new Error('Canvas 2D is unavailable.'); }
let game = null, paused = false, speed = 1, screen = 'journey', selectedChapter = 0, resultShown = false;
let pointer = null, lastTime = performance.now(), accumulator = 0, toastTimer = 0, dialogKind = '', checkpointShots = -1, lastHUD = 0;
const today = () => new Date().toISOString().slice(0, 10);
const number = n => Math.round(n).toLocaleString();
const completedCount = () => LEVELS.filter(l => store.profile.records[l.id]?.completed).length;
const totalStars = () => Object.values(store.profile.records).reduce((n, r) => n + r.stars.filter(Boolean).length, 0);
const unlocked = level => { const index = LEVELS.findIndex(l => l.id === level.id); return index <= 0 || !!store.profile.records[LEVELS[index - 1].id]?.completed; };
const nextLevel = () => LEVELS.find(l => !store.profile.records[l.id]?.completed) ?? LEVELS[0];
const starsHTML = stars => [0, 1, 2].map(i => `<span class="${stars?.[i] ? '' : 'unearned'}">✦</span>`).join('');

function applySettings() {
  document.body.classList.toggle('high-contrast', settings.highContrast);
  document.body.classList.toggle('reduced-motion', settings.reducedMotion);
  sound.configure(settings); renderer.settings = settings;
  if (game && game.phase === 'aiming') game.assist = settings.assist;
  if ($('inputHint')) $('inputHint').textContent = settings.tapAim ? 'Tap an angle, then choose Send the light. Keyboard aiming also works.' : 'Drag upward to aim. Release to send the light.';
}
function persist() {
  store.save(); $('saveStatus').innerHTML = store.available ? 'Progress stays in this browser <i></i>' : 'Saving unavailable · export a backup';
}
function saveSession() {
  if (!game || ['victory', 'defeat'].includes(game.phase)) { store.profile.session = null; persist(); return; }
  const saved = game.phase === 'aiming' ? checkpoint(game) : game.snapshot ? structuredClone(game.snapshot) : null;
  if (saved) { saved.phase = 'aiming'; saved.balls = []; saved.events = []; saved.snapshot = null; store.profile.session = saved; persist(); }
}
function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}
function announce(message) { $('announcer').textContent = message; }
function markNavigation(name) {
  document.querySelectorAll('.nav-link').forEach(button => button.classList.toggle('active', button.dataset.action === name));
  $('atlasCount').textContent = `${completedCount()}/24`;
}
function showMenu(name = 'journey') {
  closeDialog(false); pointer = null; paused = true; saveSession();
  screen = name; $('playView').hidden = true; $('menuView').hidden = false; document.body.classList.remove('playing');
  sound.pause(); markNavigation(name); renderMenu(); window.scrollTo({ top: 0, behavior: 'instant' });
}
function renderMenu() {
  if (screen === 'atlas') return renderAtlas();
  if (screen === 'daily' || screen === 'endless') return renderMode(screen);
  renderJourney();
}
function renderJourney() {
  const next = nextLevel(), count = completedCount(), chapter = CHAPTERS[selectedChapter];
  const resumable = (game && !['victory', 'defeat'].includes(game.phase)) || store.profile.session;
  $('menuView').innerHTML = `
    <section class="home-hero"><div class="hero-copy"><p class="eyebrow">A RICOCHET JOURNEY THROUGH THE LOST ATLAS</p><h1>Follow the angle.<br><em>Restore the stars.</em></h1><p>Send a little light through ancient chambers. Unravel constellations, uncover mosaics, and find the sky beneath the sand.</p><div class="hero-buttons"><button class="button button-gold" data-action="${resumable ? 'continue' : count === 24 ? 'atlas' : 'start'}" data-level="${next.id}">${resumable ? 'Continue your journey' : count === 24 ? 'Explore your atlas' : count ? 'Next chamber' : 'Begin the journey'} <span>↗</span></button><button class="button button-outline" data-action="help">How to play</button></div><div class="hero-meta"><span><b>24</b> crafted chambers</span><span><b>4</b> lost worlds</span><span><b>${totalStars()}</b> / 72 stars</span></div></div><div class="hero-art" aria-hidden="true"><img src="assets/mosaic.svg" alt=""><span class="orbit-star">✦</span><span class="orbit-note">THE SKY REMEMBERS YOUR HANDS</span></div></section>
    <section class="chapter-section" aria-label="Campaign chambers"><div class="section-top"><h2>The restorer’s journey</h2><span>${count} of 24 chambers restored</span></div><div class="chapter-tabs">${CHAPTERS.map(c => { const done = LEVELS.filter(l => l.chapter === c.id && store.profile.records[l.id]?.completed).length; const locked = !unlocked(LEVELS.find(l => l.chapter === c.id)); return `<button class="chapter-tab ${selectedChapter === c.id ? 'active' : ''}" data-action="chapter" data-chapter="${c.id}" aria-pressed="${selectedChapter === c.id}"><span class="chapter-number">0${c.id + 1}</span><span><strong>${escape(c.name)}</strong><small>${done}/6 restored</small></span>${locked ? '<span class="locked-mark" aria-label="Chapter locked">◇</span>' : ''}</button>`; }).join('')}</div><div class="chapter-map"><div class="chapter-intro"><div><span class="eyebrow">CHAPTER 0${chapter.id + 1}</span><h3>${escape(chapter.name)}</h3><p>${escape(chapter.description)}</p></div><small>${escape(chapter.subtitle)}</small></div><div class="level-path">${LEVELS.filter(l => l.chapter === selectedChapter).map(l => { const record = store.profile.records[l.id]; const available = unlocked(l); return `<button class="level-node ${l.finale ? 'finale' : ''} ${record?.completed ? 'complete' : l.id === next.id ? 'current' : ''}" data-action="start" data-level="${l.id}" ${!available ? 'disabled' : ''} aria-label="${escape(l.name)}, ${record?.completed ? `${record.stars.filter(Boolean).length} stars` : available ? 'available' : 'locked'}"><span class="level-circle"><span>${record?.completed ? '✓' : available ? l.index : '·'}</span></span><small>${escape(l.name)}</small><span class="level-stars" aria-hidden="true">${starsHTML(record?.stars)}</span></button>`; }).join('')}</div></div><div class="journey-bottom"><button data-action="daily"><span class="daily-dot">✦</span> Daily mosaic · a shared pattern for ${today()}</button><button data-action="endless">Explore the endless caravan →</button></div></section>`;
}
function renderAtlas() {
  const count = completedCount();
  const styles = [{id:'ivory',name:'Carved ivory',need:0,color:'#f1e7ce'},{id:'lapis',name:'Rain on lapis',need:6,color:'#9bc4f0'},{id:'copper',name:'Copper sun',need:12,color:'#f3b688'},{id:'starlight',name:'Captured starlight',need:24,color:'#d9c5ff'}];
  const discoveries = LEVELS.filter(l => store.profile.records[l.id]?.completed);
  const milestones = [['first-light','First light'],['cartographer','Gatekeeper'],['constellation','Sky reader'],['master-craft','Atlas keeper'],['wanderer','Eightfold echo']];
  $('menuView').innerHTML = `<div class="page-heading"><p class="eyebrow">YOUR COLLECTION OF LIGHT</p><h1>The astronomical atlas</h1><p>Each restored chamber adds a little color to the sky. Your discoveries and craftsmanship stay with you in this browser.</p></div><div class="atlas-grid">${CHAPTERS.map(c => { const done=discoveries.filter(l=>l.chapter===c.id).length;return `<article class="atlas-piece ${done<6?'locked':''}"><img src="${c.background}" alt="${escape(c.name)} geometric architecture"><div class="piece-caption"><p class="eyebrow">CHAPTER 0${c.id+1}</p><h3>${escape(c.name)}</h3><p>${done===6?'✦ Mosaic restored':`${done}/6 fragments discovered`}</p></div></article>`;}).join('')}</div><section class="workshop"><div class="workshop-header"><h2>The orb workshop</h2><span class="eyebrow">EXPRESSION, NEVER EXTRA POWER</span></div><div class="orb-options">${styles.map(s=>`<button class="orb-option ${settings.orb===s.id?'selected':''}" data-action="orb" data-orb="${s.id}" ${count<s.need?'disabled':''} aria-pressed="${settings.orb===s.id}"><span class="orb-swatch" style="background:${s.color}"></span><span><strong>${s.name}</strong><small>${count<s.need?`Restore ${s.need} chambers` : settings.orb===s.id?'Your chosen light':'Choose this orb'}</small></span></button>`).join('')}</div></section><div class="milestone-strip" aria-label="Journey milestones">${milestones.map(([id,label])=>`<span class="milestone ${store.profile.achievements.includes(id)?'earned':''}">${store.profile.achievements.includes(id)?'✦':'◇'} ${label}</span>`).join('')}</div><section class="workshop"><div class="workshop-header"><h2>The restorer’s journal</h2><span class="eyebrow">${count} DISCOVERIES · ${totalStars()} STARS</span></div>${discoveries.length?`<div class="journal">${discoveries.slice().reverse().map(l=>`<article class="journal-entry"><p class="eyebrow">${escape(CHAPTERS[l.chapter].name)} · ${l.index}</p><h3>${escape(l.name)}</h3><p>${escape(l.lore)}</p></article>`).join('')}</div>`:'<p class="empty-note">Your journal is waiting for its first discovery. Restore First Light to leave a trace beneath the stars.</p>'}</section><div class="dialog-actions"><button class="button button-gold" data-action="journey">Return to the journey ↗</button><button class="button button-outline" data-action="export">Export your progress</button></div>`;
}
function renderMode(mode) {
  const daily = mode === 'daily', level = daily ? createDaily(today()) : createEndless('astral-caravan-v2');
  const best = daily ? store.profile.daily[today()]?.score ?? 0 : store.profile.endlessBest;
  $('menuView').innerHTML = `<div class="page-heading"><p class="eyebrow">${daily?'ONE SKY, ONE SHARED PATTERN':'BEYOND THE EDGE OF THE ATLAS'}</p><h1>${daily?'The daily mosaic':'The endless caravan'}</h1><p>${daily?'A new reflection of a crafted chamber, shared by every traveler. Take your time; you can return and try again.':'A growing procession of constellations. Find clever routes through the caravan before the falling sands reach your light.'}</p></div><section class="mode-card"><div><p class="eyebrow">${daily?today()+' · UTC':'A SEEDED JOURNEY'}</p><h2>${daily?'Today’s sky is waiting.':'There is always another light.'}</h2><p>${escape(level.description)} ${daily?'The pattern changes at midnight UTC. Scores are local to your browser.':'New batches arrive as you restore the old. Every third batch brings a fresh Pierce charge.'}</p><div class="mode-specs"><span>${daily?level.tiles.length:'∞'}<small>${daily?'opening fragments':'constellations'}</small></span><span>${number(best)}<small>your best score</small></span><span>${daily?'↻':'3'}<small>${daily?'free replays':'starting abilities'}</small></span></div><div class="hero-buttons"><button class="button button-gold" data-action="${daily?'startDaily':'startEndless'}">${daily?'Restore today’s mosaic':'Join the caravan'} ↗</button>${daily?'<button class="button button-outline" data-action="shareDaily">Share the pattern</button>':''}</div></div><div class="mode-art"><img src="${CHAPTERS[level.chapter].background}" alt="${escape(CHAPTERS[level.chapter].name)} architecture"></div></section><div class="dialog-actions"><button class="text-button" data-action="journey">← Return to your journey</button></div>`;
}
function startLevel(level, resume = false) {
  closeDialog(false); sound.unlock();
  if (!resume) { game = createGame(level, { assist: settings.assist }); resultShown = false; renderer.reset(); }
  paused = false; speed = 1; checkpointShots = -1; lastTime = performance.now(); accumulator = 0; pointer = null;
  $('menuView').hidden = true; $('playView').hidden = false; document.body.classList.add('playing');
  markNavigation('journey'); $('levelName').textContent = game.level.name;
  $('levelEyebrow').textContent = `${CHAPTERS[game.level.chapter].name} ${game.level.endless ? '· ENDLESS' : game.level.daily ? '· DAILY MOSAIC' : `· CHAMBER ${game.level.index} OF 6`}`;
  $('objectiveText').textContent = game.level.objective;
  $('modeBadge').textContent = game.level.daily ? 'DAILY' : game.level.endless ? 'ENDLESS' : 'CAMPAIGN';
  $('craftText').textContent = game.level.craft.label; $('parText').textContent = `Par: ${game.level.par} shots · one free rewind`;
  $('loreText').textContent = game.level.lore; $('tutorialText').textContent = game.level.tutorial;
  $('tutorialCard').hidden = !game.level.tutorial;
  const types = [...new Set([...game.level.tiles.map(t=>t.type), ...(game.level.fixtures.length?['mirror']:[])])];
  $('materialList').innerHTML = types.map(type=>`<button class="material-pill" data-action="material" data-material="${type}"><i style="background:${MATERIALS[type].color}"></i>${MATERIALS[type].label}</button>`).join('');
  applySettings(); updateHUD(); requestAnimationFrame(() => { fitBoard(); renderer.draw(game); $('gameCanvas').focus({preventScroll:true}); });
  window.scrollTo({top:0,behavior:'instant'}); saveSession();
  announce(`${game.level.name}. ${game.level.objective} ${game.level.tutorial}`);
  if (game.level.tutorial && window.innerWidth <= 640 && !resume) toast(game.level.tutorial);
}
function continueGame() {
  if (game && !['victory','defeat'].includes(game.phase)) return startLevel(game.level, true);
  if (store.profile.session) {
    const saved = store.profile.session;
    const canonical = LEVELS.find(l=>l.id===saved.level.id) ?? (saved.level.daily ? createDaily(saved.level.dateKey) : saved.level.endless ? createEndless(saved.level.seed) : null);
    if (canonical) { game = saved; game.level = canonical; game.stats.maxHits ??= 0; game.events=[]; resultShown=false; startLevel(canonical,true); toast('Resumed at your last aiming checkpoint.'); return; }
    store.profile.session=null;
  }
  startLevel(nextLevel());
}
function updateHUD() {
  if (!game) return;
  const aiming = game.phase==='aiming', flying = game.phase==='flight';
  $('restoredNumber').textContent = `${game.stats.restored}/${game.stats.totalTargets}`;
  $('restorationFill').style.width = `${Math.min(100,game.stats.restored/Math.max(1,game.stats.totalTargets)*100)}%`;
  $('shotNumber').textContent = game.shots; $('scoreNumber').textContent = number(game.score); $('turnText').textContent = `TURN ${game.turn}`;
  const nearest = game.tiles.filter(t=>t.alive).reduce((min,t)=>Math.min(min,WORLD.danger-t.y-t.h/2),999);
  const descent = game.level.descent * (game.assist ? .65 : 1);
  const breaths = descent ? Math.max(0,Math.ceil(nearest/descent)) : Infinity;
  $('mobileProgress').textContent = `${game.stats.restored}/${game.stats.totalTargets} restored ↗`;
  $('mobileShots').textContent = `${game.shots} shots`;
  $('mobilePressure').textContent = descent ? `${breaths} shots to breach` : 'No falling sands';
  $('pressureText').textContent = descent ? `${breaths} shots until the nearest breach` : 'No falling sands';
  document.querySelector('.pressure-note').classList.toggle('urgent',breaths<=3);
  const wave=game.waves.reduce((a,b)=>!a||b.turn<a.turn?b:a,null);
  $('waveText').textContent = wave ? `Next wave after shot ${wave.turn}` : game.level.endless ? `Caravan batch ${game.round}` : 'Every fragment has a place';
  $('phaseText').textContent = paused ? 'TAKE A BREATH' : aiming ? game.armed ? `${game.armed.toUpperCase()} ARMED · CHOOSE AN ANGLE` : 'CHOOSE YOUR ANGLE' : flying ? game.flightTime>12?'LIGHT RETURNS AT 15s':'THE LIGHT IS TRAVELING' : game.phase==='victory'?'MOSAIC RESTORED':game.phase==='defeat'?'THE SANDS REACHED YOUR LIGHT':'THE CHAMBER SETTLES';
  $('flightTime').textContent = flying ? `${game.flightTime.toFixed(1)}s` : '';
  $('angleInput').value = String(Math.round(game.angle)); $('angleValue').value=`${Math.round(game.angle)}°`;
  $('angleInput').disabled=!aiming; $('launchButton').hidden=!aiming; $('launchButton').disabled=paused;
  $('speedButton').hidden=!flying; $('speedButton').textContent=speed===1?'3× speed':'1× speed'; $('speedButton').setAttribute('aria-pressed',String(speed===3));
  $('recallButton').hidden=!flying;
  for (const type of ['pierce','echo','lift']) { $(`${type}Count`).textContent=game.charges[type]; const button=document.querySelector(`[data-ability="${type}"]`);button.disabled=!aiming||!game.charges[type]||paused;button.classList.toggle('active',game.armed===type);button.setAttribute('aria-pressed',String(game.armed===type)); }
  $('rewindButton').disabled=!game.snapshot||!game.rewinds||!['aiming','defeat','resolving','descent'].includes(game.phase)||paused;
  if(aiming&&checkpointShots!==game.shots){checkpointShots=game.shots;saveSession();}
}
function fitBoard() {
  if ($('playView').hidden) return;
  const column=document.querySelector('.board-column');
  const mobile=window.innerWidth<=640;
  const dock=$('controlDock'), panel=document.querySelector('.chamber-panel');
  if(mobile&&dock.parentElement!==column)column.appendChild(dock);
  else if(!mobile&&dock.parentElement!==panel)panel.insertBefore(dock,$('tutorialCard'));
  const top=$('boardFrame').getBoundingClientRect().top;
  const controls=mobile?document.querySelector('.shot-controls').getBoundingClientRect().height+12:0;
  const abilities=mobile?$('abilityTray').getBoundingClientRect().height+12:0;
  const hint=mobile?$('inputHint').getBoundingClientRect().height+9:0;
  const footer=0;
  const height=Math.max(240,window.innerHeight-top-controls-abilities-hint-footer-24);
  const layout=document.querySelector('.play-layout');
  const maxWidth=mobile ? layout.getBoundingClientRect().width : layout.getBoundingClientRect().width-(window.innerWidth>900?260:210)-28;
  const width=Math.max(160,Math.min(430,maxWidth,height*2/3));
  column.style.width=`${Math.floor(width)}px`;column.style.maxWidth='430px';
  if(!mobile)layout.style.gridTemplateColumns=`${window.innerWidth>900?260:210}px ${Math.floor(width)}px`;else layout.style.gridTemplateColumns='';
  renderer.resize();
}
function openDialog(kind, content) {
  pointer=null;dialogKind=kind;
  if(!$('playView').hidden){paused=true;sound.pause();}
  $('dialogContent').innerHTML=content;
  if(!$('dialog').open)$('dialog').showModal();
  updateHUD();
}
function closeDialog(resume=true) {
  if($('dialog').open)$('dialog').close();
  dialogKind='';
  if(resume&&!$('playView').hidden&&game&&!['victory','defeat'].includes(game.phase)){paused=false;lastTime=performance.now();accumulator=0;sound.resume();$('gameCanvas').focus({preventScroll:true});}
  updateHUD();
}
const dialogTop = (eyebrow, closeAction='close') => `<div class="dialog-top"><span class="eyebrow">${eyebrow}</span><button class="dialog-close" data-action="${closeAction}" aria-label="Close">×</button></div>`;
function showPause(){if(!game)return;openDialog('pause',`<div class="dialog-inner">${dialogTop('THE LIGHT CAN WAIT')}<h2>Take a breath.</h2><p>${escape(game.level.name)} · ${game.shots} shots · ${number(game.score)} points.<br>Your light will be right where you left it.</p><div class="dialog-actions"><button class="button button-gold" data-action="close">Continue ↗</button><button class="button button-outline" data-action="restart">Restart chamber</button><button class="button button-outline" data-action="journey">Journey map</button></div><div class="dialog-actions"><button class="text-button" data-action="settings">Settings</button><button class="text-button" data-action="help">Controls & help</button></div></div>`);saveSession();}
function showSettings(){openDialog('settings',`<div class="dialog-inner">${dialogTop('MAKE YOURSELF AT HOME')}<h2>A quieter kind of play.</h2><p>Preferences are saved in this browser. Every chamber can be replayed freely.</p>${[['sfx','Sound effects','Ceramic, glass, and little moments of light.'],['music','Ambient harmonies','An original, softly drifting soundscape.']].map(([key,label,detail])=>`<label class="settings-row"><span><strong>${label}</strong><small>${detail}</small></span><input type="range" min="0" max="1" step=".05" value="${settings[key]}" data-setting="${key}" aria-label="${label} volume"></label>`).join('')}${[['tapAim','Tap to aim','Choose an angle, then use the Launch button.'],['reducedMotion','Reduced motion','Quiet trails and fragments; no large movement.'],['highContrast','High contrast','Brighter outlines and clearer interface text.'],['assist','Gentler sands','Slower descent and a longer guide. Applies at the next aiming turn.']].map(([key,label,detail])=>`<label class="settings-row"><span><strong>${label}</strong><small>${detail}</small></span><input type="checkbox" data-setting="${key}" ${settings[key]?'checked':''}></label>`).join('')}<div class="dialog-actions"><button class="button button-gold" data-action="close">Done</button><button class="button button-outline" data-action="export">Export save</button><button class="button button-outline" data-action="import">Import save</button></div><p style="font-size:10px;margin:15px 0 0">No account or installation required. Export a backup to carry your progress to another browser.</p></div>`);}
function showHelp(){openDialog('help',`<div class="dialog-inner">${dialogTop('THE LANGUAGE OF RICOCHETS')}<h2>Send a little light.</h2><div class="help-list">${[['Choose an angle','Drag upward on the board and release to launch. You can also adjust the angle slider and choose Send the light. Tap-to-aim is available in Settings.'],['Restore the pattern','The orb rebounds from walls, ceramics, and anchored mirrors. Numbers show hits remaining. Touching constellation tiles spread damage when they break.'],['Read the falling sands','After a shot, targets descend. A target crossing the marked breach line ends the attempt. Anchored mirrors stay in place. Clear all fragments and finite waves to win.'],['Make room for wonder','Pierce passes through two targets. Echo sends a mirrored orb. Lift raises the pattern. Every charge refills on replay. One rewind lets you rethink your last shot.'],['Keep your light moving','Use 3× speed or Recall during long flights. Light automatically returns after 15 simulated seconds. Recall keeps damage dealt and spends the turn normally.']].map(([title,body],i)=>`<div class="help-item"><span class="help-number">${i+1}</span><div><strong>${title}</strong><p>${body}</p></div></div>`).join('')}</div><div class="keyboard-legend"><kbd>←</kbd> <kbd>→</kbd> adjust angle · <kbd>Shift</kbd> larger steps<br><kbd>Enter</kbd> send light · <kbd>F</kbd> speed · <kbd>R</kbd> recall<br><kbd>Escape</kbd> pause · <kbd>Space</kbd> launch / speed</div><div class="dialog-actions"><button class="button button-gold" data-action="close">Follow the angle ↗</button></div></div>`);}
function showInspector(){if(!game)return;openDialog('inspect',`<div class="dialog-inner">${dialogTop('A CLOSER LOOK')}<h2>The chamber’s pattern.</h2><p>${escape(game.level.objective)} ${game.stats.restored}/${game.stats.totalTargets} restored. ${escape($('pressureText').textContent)}. Columns run left to right, 1–8.</p><div class="board-inspector"><table><thead><tr><th>Material</th><th>Column</th><th>Height</th><th>HP</th></tr></thead><tbody>${game.tiles.filter(t=>t.alive).sort((a,b)=>a.y-b.y||a.x-b.x).map(t=>`<tr><td>${MATERIALS[t.type].label}</td><td>${t.col+1}</td><td>${Math.round(t.y)} / 720</td><td>${t.hp}</td></tr>`).join('')}${game.fixtures.map(f=>`<tr><td>Mirror · ${f.orientation}</td><td>${f.col+1}</td><td>${f.y}</td><td>fixed</td></tr>`).join('')}</tbody></table></div><div class="dialog-actions"><button class="button button-gold" data-action="close">Back to the light</button></div></div>`);}
function recordResult(){
  if(!game)return;const stars=starsFor(game);
  if(game.level.endless){store.profile.endlessBest=Math.max(store.profile.endlessBest,game.score);}
  else if(game.level.daily&&game.phase==='victory'){const old=store.profile.daily[game.level.dateKey];store.profile.daily[game.level.dateKey]={score:Math.max(old?.score??0,game.score),stars:stars.map((s,i)=>s||old?.stars?.[i])};}
  else if(game.phase==='victory'){
    const old=store.profile.records[game.level.id];
    store.profile.records[game.level.id]={completed:true,stars:stars.map((s,i)=>s||old?.stars?.[i]),score:Math.max(old?.score??0,game.score),shots:old?.shots?Math.min(old.shots,game.shots):game.shots,assisted:(old?.completed?old.assisted:true)&&game.usedAssist};
    selectedChapter=game.level.chapter;
    const milestones=[['first-light',1],['cartographer',6],['constellation',12],['master-craft',24]];
    for(const [id,required]of milestones)if(completedCount()>=required&&!store.profile.achievements.includes(id))store.profile.achievements.push(id);
  }
  if(game.stats.maxChain>=8&&!store.profile.achievements.includes('wanderer'))store.profile.achievements.push('wanderer');
  store.profile.session=null;persist();markNavigation('journey');
}
function showResult(){
  if(!game||resultShown)return;resultShown=true;recordResult();
  const won=game.phase==='victory',stars=starsFor(game),index=LEVELS.findIndex(l=>l.id===game.level.id),next=index>=0?LEVELS[index+1]:null;
  const allRestored=won&&completedCount()===24&&game.level.id===LEVELS.at(-1).id;
  openDialog('result',`<div class="dialog-inner result-inner">${dialogTop(won?'ANOTHER LIGHT IN THE ATLAS':'THE SANDS KEEP THEIR SECRETS','journey')}${won?'<div class="result-art" aria-hidden="true"></div>':''}<h2>${allRestored?'The atlas awakens.':won?'A little sky, restored.':game.level.endless?'A beautiful distance.':'The light will return.'}</h2><p>${won?escape(game.level.name)+' is restored.':game.level.endless?`Your caravan reached batch ${game.round}. Best local score: ${number(store.profile.endlessBest)}.`:'A fragment reached the breach line. A new angle can change everything.'}</p>${won?`<div class="result-stars" aria-label="${stars.filter(Boolean).length} stars earned">${stars.map(s=>`<span class="${s?'earned':''}">✦</span>`).join('')}</div>`:''}<div class="result-stats"><div><strong>${number(game.score)}</strong><small>SCORE</small></div><div><strong>${game.shots}</strong><small>SHOTS</small></div><div><strong>${game.stats.maxChain}</strong><small>BEST CHAIN</small></div></div>${won?`<div class="star-checks"><div><span>${stars[0]?'✓':'○'}</span>Every fragment restored</div><div><span>${stars[1]?'✓':'○'}</span>Within ${game.level.par} shots</div><div><span>${stars[2]?'✓':'○'}</span>${escape(game.level.craft.label)}</div></div><p class="result-lore">${escape(game.level.lore)}</p>`:''}<div class="dialog-actions">${won&&next?`<button class="button button-gold" data-action="start" data-level="${next.id}">Next chamber ↗</button>`:won?'<button class="button button-gold" data-action="atlas">View your atlas ↗</button>':'<button class="button button-gold" data-action="restart">Try a new angle ↗</button>'}${!won&&game.rewinds&&game.snapshot?'<button class="button button-outline" data-action="rewind">Use your rewind ↶</button>':''}<button class="button button-outline" data-action="${won?'restart':'journey'}">${won?'Restore again':'Journey map'}</button></div>${game.assist?'<p style="font-size:10px;margin:16px 0 0">Gentler sands enabled. Your discoveries count fully.</p>':''}</div>`);
  announce(won?`${game.level.name} restored. ${stars.filter(Boolean).length} stars earned in ${game.shots} shots.`:'The sands reached your light. Retry or rewind your last shot.');
}
function fire(){if(!game||paused||game.phase!=='aiming')return;sound.unlock();if(launch(game)){speed=1;saveSession();updateHUD();}}
function setAngleFromPoint(point){if(!game||game.phase!=='aiming')return;const dy=WORLD.floor-point.y;if(dy<5)return false;game.angle=clamp(Math.atan2(dy,point.x-game.launcher.x)*180/Math.PI,12,168);updateHUD();return true;}
function toggleSpeed(){if(game?.phase==='flight'&&!paused){speed=speed===1?3:1;updateHUD();}}
async function shareDaily(){const key=game?.level.daily?game.level.dateKey:today();const url=new URL(location.href);url.hash=`mosaic=${key}&v=2`;try{await navigator.clipboard.writeText(url.href);toast('Pattern link copied. Scores stay local.');}catch{openDialog('share',`<div class="dialog-inner">${dialogTop('A PATTERN TO SHARE')}<h2>Under the same sky.</h2><p>Copy this link to share the mosaic. It contains only the date of the pattern.</p><input style="width:100%;padding:12px;background:var(--ink);border:1px solid var(--line);color:var(--paper)" value="${escape(url.href)}" aria-label="Daily mosaic link" readonly><div class="dialog-actions"><button class="button button-gold" data-action="close">Done</button></div></div>`);}}
function exportSave(){const blob=new Blob([store.export()],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`dune-arcanum-${today()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Your atlas backup is ready.');}

document.addEventListener('click', event => {
  const button=event.target.closest('button[data-action]');if(!button||button.disabled)return;
  const action=button.dataset.action;
  if(['journey','atlas','daily','endless'].includes(action)){showMenu(action);return;}
  if(action==='chapter'){selectedChapter=Number(button.dataset.chapter);renderJourney();return;}
  if(action==='start'){const level=LEVELS.find(l=>l.id===button.dataset.level);if(level&&unlocked(level))startLevel(level);return;}
  if(action==='continue'){continueGame();return;}
  if(action==='startDaily'){startLevel(createDaily(today()));return;}
  if(action==='startEndless'){startLevel(createEndless('astral-caravan-v2'));return;}
  if(action==='restart'){if(game)startLevel(game.level);return;}
  if(action==='pause'||action==='leave'){showPause();return;}
  if(action==='close'){closeDialog();return;}
  if(action==='settings'){showSettings();return;}
  if(action==='help'){showHelp();return;}
  if(action==='inspect'){showInspector();return;}
  if(action==='material'){const m=MATERIALS[button.dataset.material];openDialog('material',`<div class="dialog-inner">${dialogTop('A MATERIAL WITH A MEMORY')}<h2>${m.label}</h2><p>${m.detail}</p><div class="dialog-actions"><button class="button button-gold" data-action="close">Back to the pattern</button></div></div>`);return;}
  if(action==='launch'){fire();return;}
  if(action==='speed'){toggleSpeed();return;}
  if(action==='recall'){if(game&&!paused){recall(game);updateHUD();}return;}
  if(action==='ability'){if(game&&!paused&&armAbility(game,button.dataset.ability)){updateHUD();toast(game.armed?`${game.armed[0].toUpperCase()+game.armed.slice(1)} armed. Select it again to cancel.`:'Ability cancelled.');}return;}
  if(action==='rewind'){if(game){const restored=rewind(game);if(restored){game=restored;resultShown=false;startLevel(game.level,true);toast('One shot reconsidered. Follow a new angle.');}}return;}
  if(action==='orb'){const requirements={ivory:0,lapis:6,copper:12,starlight:24};if(completedCount()>=requirements[button.dataset.orb]){settings.orb=button.dataset.orb;persist();renderAtlas();toast('Your light has a new look.');}return;}
  if(action==='shareDaily'){shareDaily();return;}
  if(action==='export'){exportSave();return;}
  if(action==='import'){$('importInput').click();return;}
});
document.addEventListener('input',event=>{
  const key=event.target.dataset.setting;
  if(key){settings[key]=event.target.type==='checkbox'?event.target.checked:Number(event.target.value);if(key==='music'||key==='sfx')sound.unlock();applySettings();persist();updateHUD();return;}
  if(event.target.id==='angleInput'&&game?.phase==='aiming'){game.angle=Number(event.target.value);updateHUD();}
});
$('importInput').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>256000)throw new Error('Choose a smaller Dune Arcanum JSON export.');store.import(await file.text());Object.assign(settings,store.profile.settings);store.profile.settings=settings;applySettings();persist();toast('Your atlas has been merged with this browser’s progress.');if($('playView').hidden)renderMenu();}catch(error){toast(error.message==='Unexpected token'? 'That file is not a valid save.':`Could not import: ${error.message}`);}event.target.value='';});
$('dialog').addEventListener('cancel',event=>{event.preventDefault();if(dialogKind==='result')showMenu('journey');else closeDialog();});
$('gameCanvas').addEventListener('pointerdown',event=>{
  if(paused||game?.phase!=='aiming'||pointer||event.button>0)return;
  const point=renderer.coordinates(event.clientX,event.clientY);
  pointer={id:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false,valid:setAngleFromPoint(point)};
  $('gameCanvas').setPointerCapture(event.pointerId);$('gameCanvas').focus({preventScroll:true});sound.unlock();
});
$('gameCanvas').addEventListener('pointermove',event=>{
  if(!game)return;const point=renderer.coordinates(event.clientX,event.clientY);
  if(pointer?.id===event.pointerId){pointer.moved ||= Math.hypot(event.clientX-pointer.startX,event.clientY-pointer.startY)>6;pointer.valid=setAngleFromPoint(point);}
  else if(!paused&&game.phase==='aiming'&&event.pointerType==='mouse'){const tile=renderer.pick(game,point.x,point.y);$('tileTooltip').hidden=!tile;if(tile){const m=MATERIALS[tile.type];$('tileTooltip').innerHTML=`<strong>${m.label}${tile.hp>1?' · '+tile.hp+' hits':''}</strong><small>${m.detail}</small>`;}}
});
$('gameCanvas').addEventListener('pointerup',event=>{
  if(pointer?.id!==event.pointerId)return;const gesture=pointer;pointer=null;
  if($('gameCanvas').hasPointerCapture(event.pointerId))$('gameCanvas').releasePointerCapture(event.pointerId);
  $('tileTooltip').hidden=true;
  if(gesture.valid&&!paused){if(!settings.tapAim&&gesture.moved)fire();else if(!settings.tapAim)toast('Drag a little to launch, or use Send the light.');}
  else if(!gesture.valid)toast('Aim above your orb to send the light upward.');
});
for(const name of ['pointercancel','lostpointercapture','pointerleave'])$('gameCanvas').addEventListener(name,()=>{if(name!=='pointerleave')pointer=null;$('tileTooltip').hidden=true;});
window.addEventListener('keydown',event=>{
  if($('dialog').open)return;
  if(!game||$('playView').hidden)return;
  const formFocus=['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName);
  if(event.code==='Escape'){event.preventDefault();showPause();return;}
  if(formFocus&&document.activeElement!==$('gameCanvas'))return;
  if(paused)return;
  if(game.phase==='aiming'&&['ArrowLeft','ArrowRight'].includes(event.code)){event.preventDefault();game.angle=clamp(game.angle+(event.code==='ArrowLeft'?1:-1)*(event.shiftKey?5:1),12,168);updateHUD();}
  if(event.code==='Enter'&&game.phase==='aiming'){event.preventDefault();fire();}
  if(event.code==='Space'){event.preventDefault();if(game.phase==='aiming')fire();else toggleSpeed();}
  if(event.code==='KeyF')toggleSpeed();
  if(event.code==='KeyR'&&game.phase==='flight'){recall(game);updateHUD();}
});
window.addEventListener('resize',()=>{requestAnimationFrame(fitBoard);pointer=null;});
window.visualViewport?.addEventListener('resize',()=>requestAnimationFrame(fitBoard));
document.addEventListener('visibilitychange',()=>{lastTime=performance.now();accumulator=0;pointer=null;if(document.hidden){saveSession();sound.pause();if(game&&!$('playView').hidden&&!paused&&!['victory','defeat'].includes(game.phase))showPause();}});
window.addEventListener('pagehide',saveSession);

function frame(now){
  const dt=Math.min(.05,Math.max(0,(now-lastTime)/1000));lastTime=now;
  if(game&&!$('playView').hidden){
    if(!paused){accumulator=Math.min(.18,accumulator+dt*speed);let count=0;while(accumulator>=WORLD.step&&count++<24){stepGame(game);accumulator-=WORLD.step;}
      for(const event of drainEvents(game)){renderer.effect(event);sound.event(event);if(event.type==='ready'){game.assist=settings.assist;game.usedAssist ||= settings.assist;}if(event.type==='resolve')announce(`Shot ${game.shots}: ${event.breaks} fragments restored.`);if(event.type==='recall'&&event.automatic)toast('Your light returned after a long journey.');}
      renderer.update(dt);if(now-lastHUD>80){updateHUD();lastHUD=now;}if(['victory','defeat'].includes(game.phase))showResult();
    }
    renderer.draw(game,{paused});
  }
  requestAnimationFrame(frame);
}
const validation=validateLevels();if(validation.length)console.error('Invalid campaign content:',validation);
if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)settings.reducedMotion=true;
applySettings();selectedChapter=nextLevel().chapter;renderJourney();persist();requestAnimationFrame(frame);
const hash=new URLSearchParams(location.hash.slice(1));const sharedDate=hash.get('mosaic');
if(sharedDate&&(!hash.get('v')||hash.get('v')==='2')&&/^\d{4}-\d{2}-\d{2}$/.test(sharedDate)&&Number.isFinite(Date.parse(sharedDate))){startLevel(createDaily(sharedDate));toast(`Shared mosaic for ${sharedDate}.`);}
// Browser caching only. No install UI, account, package download, or backend is needed.
if('serviceWorker'in navigator&&['http:','https:'].includes(location.protocol)&&!['localhost','127.0.0.1'].includes(location.hostname))window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});});
