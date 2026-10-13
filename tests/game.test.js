import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WORLD, sweepRect, sweepSegment, earliestEvent, reflect } from '../src/physics.js';
import { createGame, launch, stepGame, damageTile, recall, rewind, starsFor, buildPreview } from '../src/engine.js';
import { LEVELS, createDaily, createEndless, generateEndlessWave, validateLevels } from '../src/levels.js';
import { SaveStore, freshProfile, sanitizeProfile } from '../src/storage.js';

const basic = overrides => ({id:'test',chapter:0,name:'Test',tiles:[{col:3,row:2,type:'ceramic',hp:1}],fixtures:[],waves:[],descent:0,par:4,abilityCharges:{},craft:{kind:'noAbility'},...overrides});
function resolve(game) {let steps=0;while(!['aiming','victory','defeat'].includes(game.phase)&&steps++<2100)stepGame(game);assert.ok(steps<2100,'shot and resolve must terminate');return game;}

test('circle sweeps have outward normals and do not tunnel',()=>{
  const tile={x:200,y:200,w:54,h:40};
  const left=sweepRect({x:100,y:200,vx:1000,vy:0,radius:8},tile,.2);
  assert.equal(left.nx,-1);assert.equal(left.ny,0);assert.ok(Math.abs(left.t-.065)<1e-8);
  const right=sweepRect({x:300,y:200,vx:-1000,vy:0,radius:8},tile,.2);assert.equal(right.nx,1);
  assert.deepEqual(reflect(1000,0,left.nx,left.ny),{vx:-1000,vy:0});
});
test('parallel motion outside a slab does not collide',()=>{assert.equal(sweepRect({x:50,y:100,vx:0,vy:600,radius:8},{x:200,y:200,w:54,h:40},1),null);});
test('overlap recovery produces an outward separation for tiles and mirrors',()=>{
  const hit=sweepRect({x:200,y:200,vx:600,vy:0,radius:8},{x:200,y:200,w:54,h:40},.1);
  assert.ok(hit.penetration>=28);assert.equal(hit.t,0);
  const mirror=sweepSegment({x:200,y:200,vx:0,vy:-600,radius:8},{ax:177,ay:200,bx:223,by:200,radius:4},.1);
  assert.equal(mirror.penetration,12);assert.ok(mirror.ny>0);
});
test('rounded corner collisions preserve speed and return a diagonal normal',()=>{
  const hit=sweepRect({x:130,y:130,vx:300,vy:300,radius:8},{x:200,y:200,w:40,h:40},1);
  assert.ok(hit);assert.ok(hit.nx<-.6&&hit.ny<-.6);
  const velocity=reflect(300,300,hit.nx,hit.ny);assert.ok(Math.abs(Math.hypot(velocity.vx,velocity.vy)-Math.hypot(300,300))<1e-6);
});
test('floor cannot bypass an earlier wall',()=>{
  const hit=earliestEvent({x:470,y:694,vx:500,vy:200,radius:8},[],[],.1);
  assert.equal(hit.kind,'wall');assert.ok(hit.t<.01);
});
test('a 45 degree mirror has matching sloped collision geometry',()=>{
  const hit=sweepSegment({x:200,y:260,vx:0,vy:-600,radius:8},{ax:177,ay:223,bx:223,by:177,radius:4},.2);
  assert.ok(hit);const v=reflect(0,-600,hit.nx,hit.ny);assert.ok(Math.abs(v.vy)<1e-6);assert.ok(v.vx>599);
});
test('all authored levels and daily reflections have valid occupancy',()=>{
  assert.equal(LEVELS.length,24);assert.deepEqual(validateLevels(),[]);
  for(let i=1;i<=31;i++)assert.deepEqual(validateLevels([createDaily(`2026-10-${String(i).padStart(2,'0')}`)]),[]);
  assert.deepEqual(createDaily('2026-10-12'),createDaily('2026-10-12'));
  for(let i=1;i<=100;i++){const wave=generateEndlessWave(i,42);assert.ok(wave.length<=12);assert.ok(wave.every(t=>t.hp<=3));}
});
test('a cleared chamber wins before another descent and fixtures never prevent victory',()=>{
  const game=createGame(basic({descent:500,fixtures:[{col:1,row:5,type:'mirror',orientation:'slash'}]}));
  launch(game,90);for(const tile of game.tiles)tile.alive=false;recall(game);resolve(game);
  assert.equal(game.phase,'victory');assert.equal(game.fixtures[0].y,324);
});
test('empty boards bring in pending waves without demanding empty shots',()=>{
  const game=createGame(basic({waves:[{turn:5,tiles:[{col:2,row:0,type:'ceramic',hp:1}]}]}));
  launch(game,90);for(const tile of game.tiles)tile.alive=false;recall(game);resolve(game);
  assert.equal(game.phase,'aiming');assert.equal(game.shots,1);assert.equal(game.waves.length,0);assert.equal(game.tiles.length,1);
});
test('scripted wave turn means after that shot, and blocked entry defers safely',()=>{
  const game=createGame(basic({tiles:[{col:2,row:0,type:'reinforced',hp:3}],waves:[{turn:2,tiles:[{col:2,row:0,type:'ceramic',hp:1}]}]}));
  launch(game,12);recall(game);resolve(game);assert.equal(game.waves.length,1);assert.equal(game.waves[0].turn,2);
  launch(game,12);recall(game);resolve(game);assert.equal(game.tiles.length,1);assert.equal(game.waves.length,1);assert.equal(game.waves[0].turn,3);
});
test('atlas hearts stay sealed while targets or pending waves remain',()=>{
  const game=createGame(basic({tiles:[{col:3,row:2,type:'core',hp:2}],waves:[{turn:2,tiles:[{col:0,row:0,type:'ceramic',hp:1}]}]}));
  damageTile(game,game.tiles[0]);assert.equal(game.tiles[0].hp,2);
  game.waves=[];damageTile(game,game.tiles[0]);assert.equal(game.tiles[0].hp,1);
});
test('linked damage is finite and only propagates through breaking neighbors',()=>{
  const game=createGame(basic({tiles:[{col:1,row:2,type:'linked',hp:1,group:'a'},{col:2,row:2,type:'linked',hp:2,group:'a'},{col:3,row:2,type:'linked',hp:1,group:'a'}]}));
  damageTile(game,game.tiles[0]);assert.equal(game.tiles[1].hp,1);assert.equal(game.tiles[2].hp,1);assert.equal(game.stats.restored,1);
  damageTile(game,game.tiles[1]);assert.equal(game.stats.restored,3);
});
test('craft impact star requires impacts in one shot, not across the attempt',()=>{
  const game=createGame(basic({craft:{kind:'hits',target:4}}));game.phase='victory';game.stats.hits=10;game.stats.maxHits=3;
  assert.deepEqual(starsFor(game),[true,true,false]);game.stats.maxHits=4;assert.equal(starsFor(game)[2],true);
});
test('preview damage is isolated from live state and first contact agrees with simulation',()=>{
  const game=createGame(basic());game.launcher.x=210;const before=structuredClone(game);const preview=buildPreview(game,90);
  assert.deepEqual(game,before);assert.equal(preview.contacts[0].kind,'tile');
  launch(game,90);while(!game.events.some(e=>e.type==='hit')&&game.phase==='flight')stepGame(game);
  const hit=game.events.find(e=>e.type==='hit');assert.ok(hit);assert.equal(hit.x,game.tiles[0].x);
  assert.ok(Math.abs(preview.points[1].x-game.balls[0].x)<2);
});
test('automatic return bounds trapped and long trajectories',()=>{
  const game=createGame(basic());launch(game,12);game.balls[0].vy=0;game.flightTime=14.99;
  stepGame(game,.02);assert.equal(game.phase,'resolving');resolve(game);assert.ok(['aiming','victory'].includes(game.phase));
});
test('rewind restores damage, position, and charges but cannot restore its own charge',()=>{
  const game=createGame(basic({tiles:[{col:3,row:2,type:'ceramic',hp:1},{col:7,row:0,type:'ceramic',hp:1}],abilityCharges:{pierce:1}}));game.launcher.x=210;game.armed='pierce';launch(game,90);resolve(game);
  const restored=rewind(game);assert.ok(restored);assert.equal(restored.shots,0);assert.equal(restored.charges.pierce,1);assert.equal(restored.rewinds,0);assert.equal(restored.tiles[0].hp,1);
  launch(restored,90);resolve(restored);assert.equal(rewind(restored),null);
});
test('prism and echo cannot recursively multiply balls',()=>{
  const game=createGame(basic({tiles:[{col:3,row:2,type:'prism',hp:1},{col:4,row:1,type:'prism',hp:1}],abilityCharges:{echo:1}}));
  game.armed='echo';launch(game,90);assert.equal(game.balls.length,2);
  let maximum=2;while(game.phase==='flight'){stepGame(game);maximum=Math.max(maximum,game.balls.length);}assert.ok(maximum<=2);
});
test('endless clearing continues and gives bounded fresh targets',()=>{
  const game=createGame(createEndless(22));launch(game,90);for(const tile of game.tiles)tile.alive=false;recall(game);resolve(game);
  assert.equal(game.phase,'aiming');assert.equal(game.round,2);assert.ok(game.tiles.length>0&&game.tiles.length<=12);
});
test('all 24 recorded campaign routes replay at normal and fast render schedules',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('./campaign-routes.json',import.meta.url),'utf8'));
  const routes=Array.isArray(data)?data:data.routes;
  assert.equal(routes.length,24);
  for(const route of routes){
    const level=LEVELS.find(l=>l.id===(route.id??route.levelId));assert.ok(level,JSON.stringify(route));
    for(const batchSize of [1,6]){
      const game=createGame(level);
      for(const shot of route.route??route.commands){
        const angle=typeof shot==='number'?shot:shot.angle;if(shot.ability)game.armed=shot.ability;
        launch(game,angle);let steps=0;
        while(!['aiming','victory','defeat'].includes(game.phase)&&steps<2100){for(let i=0;i<batchSize;i++){stepGame(game);steps++;if(['aiming','victory','defeat'].includes(game.phase))break;}}
      }
      assert.equal(game.phase,'victory',`${level.name}, batch ${batchSize}`);assert.deepEqual(starsFor(game),[true,true,true],level.name);
    }
  }
});
test('save import is validated and merges rather than losing accomplishments',()=>{
  const memory=new Map();const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
  const store=new SaveStore(storage);store.profile.records['chapter-1-1']={completed:true,stars:[true,true,false],score:500,shots:2,assisted:false};store.save();
  const restored=new SaveStore(storage);assert.equal(restored.profile.records['chapter-1-1'].score,500);
  const backup=freshProfile();backup.records['chapter-1-1']={completed:true,stars:[true,false,true],score:300,shots:4};restored.import(JSON.stringify(backup));
  assert.deepEqual(restored.profile.records['chapter-1-1'].stars,[true,true,true]);assert.equal(restored.profile.records['chapter-1-1'].score,500);
  assert.throws(()=>restored.import('nope'));assert.throws(()=>sanitizeProfile({version:1}));assert.throws(()=>restored.import(' '.repeat(256001)));
});
test('denied storage keeps the game playable in memory',()=>{
  const store=new SaveStore({getItem(){throw new Error('denied')},setItem(){throw new Error('denied')}});
  assert.equal(store.available,false);assert.equal(store.save(),false);assert.equal(store.profile.version,2);
});
test('stable checkpoints survive reload while corrupted checkpoints are discarded',()=>{
  const memory=new Map();const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
  const store=new SaveStore(storage);store.profile.session=createGame(LEVELS[2]);store.save();
  const loaded=new SaveStore(storage);assert.equal(loaded.profile.session.level.id,LEVELS[2].id);
  store.profile.session.angle=null;store.save();assert.equal(new SaveStore(storage).profile.session,null);
  store.profile.session=createGame(LEVELS[2]);store.profile.session.tiles[0].type='unknown';store.save();assert.equal(new SaveStore(storage).profile.session,null);
});
test('daily backups preserve better existing local records',()=>{
  const store=new SaveStore({getItem:()=>null,setItem:()=>{}});
  store.profile.daily['2026-10-12']={score:1000,stars:[true,true,false]};
  const backup=freshProfile();backup.daily['2026-10-12']={score:200,stars:[true,false,true]};
  store.import(JSON.stringify(backup));assert.equal(store.profile.daily['2026-10-12'].score,1000);assert.deepEqual(store.profile.daily['2026-10-12'].stars,[true,true,true]);
});
test('the offline cache contains existing local assets and all runtime modules',()=>{
  const root=new URL('../',import.meta.url),worker=fs.readFileSync(new URL('sw.js',root),'utf8');
  const entries=[...worker.match(/const FILES = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
  for(const path of entries)assert.ok(fs.existsSync(new URL(path,root)),`Missing cache asset: ${path}`);
  for(const path of ['main.js','src/physics.js','src/engine.js','src/levels.js','src/renderer.js','src/audio.js','src/storage.js']){
    assert.ok(entries.includes(`./${path}`),`${path} must be playable offline`);
    const source=fs.readFileSync(new URL(path,root),'utf8');
    for(const match of source.matchAll(/from ['"]([^'"]+)['"]/g)){assert.ok(match[1].startsWith('.'),'Runtime import must be local');assert.ok(fs.existsSync(new URL(match[1],new URL(path,root))));}
  }
  const html=fs.readFileSync(new URL('index.html',root),'utf8');assert.ok(!/(?:src|href)=["']https?:\/\//.test(html),'No CDN resources');
});
