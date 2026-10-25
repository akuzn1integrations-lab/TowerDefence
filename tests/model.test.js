import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MISSIONS, MISSION_IDS, ENEMIES, TOWERS, TRAPS, UNITS, RESEARCH,
  validateContent, cellKey
} from '../src/config.js';
import {
  createMission, canBuild, build, upgrade, sell, startWave, updateMission,
  commandDrone, objectiveProgress, calculateStars, inspectAt, hasGroundPaths
} from '../src/model.js';
import {
  newProgress, sanitizeProgress, loadProgress, storeProgress, grantVictory,
  purchaseResearch, researchAvailable, campaignComplete, unlockedEquipment, SAVE_KEY
} from '../src/progress.js';

test('6 законченных секторов с несколькими биомами и валидными маршрутами',()=>{
  assert.equal(validateContent(),true);
  assert.equal(MISSION_IDS.length,6);
  assert.equal(new Set(MISSION_IDS.map(id=>MISSIONS[id].biome)).size,2);
  for(const id of MISSION_IDS){
    const m=createMission(id);
    assert.equal(hasGroundPaths(m),true);
    assert.equal(m.config.briefing.length>=3,true);
    assert.ok(m.config.map.buildCells.length>15);
    assert.ok(m.config.waves.length>=3);
    assert.equal(m.config.stars.length,3);
    assert.ok(m.config.rewards.firstMaterials>m.config.rewards.materials);
  }
});

test('карта прогрессии: следующий сектор открывается, после 6 побед глава завершена',()=>{
  const p=newProgress();
  assert.deepEqual(p.unlockedSectorIds,['sector-01']);
  for(let i=0;i<MISSION_IDS.length;i++){
    const id=MISSION_IDS[i];
    assert.ok(p.unlockedSectorIds.includes(id));
    grantVictory(p,id,2);
    assert.equal(p.sectors[id].bestStars,2);
    if(i<MISSION_IDS.length-1)assert.ok(p.unlockedSectorIds.includes(MISSION_IDS[i+1]));
  }
  assert.equal(campaignComplete(p),true);
  assert.equal(p.unlockedSectorIds.length,6);
  assert.deepEqual(unlockedEquipment(p).towers,['kinetic','pulse','mortar','antiAir']);
});

test('первая и повторная победы имеют разные награды без дублирования, рекорд не снижается',()=>{
  const p=newProgress();
  assert.deepEqual(grantVictory(p,'sector-01',3),{materials:500,data:50,first:true});
  assert.deepEqual(grantVictory(p,'sector-01',1),{materials:180,data:20,first:false});
  assert.equal(p.resources.materials,680);
  assert.equal(p.sectors['sector-01'].bestStars,3);
  assert.equal(p.sectors['sector-01'].victories,2);
});

test('миграция старых сохранений с сохранением результата сектора 01',()=>{
  const old={schemaVersion:1,sectors:{'sector-01':{briefingSeen:true,bestStars:3,firstVictoryClaimed:true,victories:1,attempts:2}},
    resources:{materials:320,data:50},research:{precision:true}};
  const migrated=sanitizeProgress(old);
  assert.equal(migrated.schemaVersion,2);
  assert.equal(migrated.sectors['sector-01'].bestStars,3);
  assert.equal(migrated.sectors['sector-02'].bestStars,0);
  assert.equal(migrated.resources.materials,320);
  assert.equal(migrated.research.precision,true);
  assert.deepEqual(migrated.unlockedSectorIds,['sector-01','sector-02']);
});

test('сохранение и обработка повреждённых данных',()=>{
  const records=new Map();
  const storage={setItem:(k,v)=>records.set(k,v),getItem:k=>records.get(k)||null};
  const p=newProgress();grantVictory(p,'sector-01',2);
  assert.equal(storeProgress(p,storage),true);
  assert.equal(loadProgress(storage).progress.sectors['sector-01'].bestStars,2);
  records.set(SAVE_KEY,'{oops');
  assert.match(loadProgress(storage).warning,/сохранение/i);
  assert.equal(loadProgress(storage).progress.resources.materials,0);
  assert.equal(sanitizeProgress({schemaVersion:2,resources:{materials:-1,data:Infinity}}).resources.materials,0);
});

test('технологии доступны по главе и тратят ресурсы ровно один раз',()=>{
  const p=newProgress();
  assert.equal(purchaseResearch(p,'precision').ok,false);
  grantVictory(p,'sector-01',1);
  assert.equal(purchaseResearch(p,'precision').ok,true);
  assert.equal(p.research.precision,true);
  assert.equal(p.resources.materials,250);
  assert.equal(purchaseResearch(p,'precision').ok,false);
  assert.equal(p.resources.materials,250);
  assert.equal(researchAvailable(p,'capacitor').ok,false);
});

test('площадки для башен и тропы для ловушек не пересекаются; стоимость проверяется заранее',()=>{
  const state=createMission('sector-03');
  const first=state.config.map.buildCells[0],path=state.config.map.trapCells[0];
  assert.equal(canBuild(state,'kinetic',path.col,path.row).ok,false);
  assert.equal(canBuild(state,'mine',first.col,first.row).ok,false);
  assert.equal(build(state,'kinetic',first.col,first.row).ok,true);
  assert.equal(build(state,'kinetic',first.col,first.row).ok,false);
  assert.equal(state.supply,state.config.startSupply-100);
  assert.equal(canBuild(state,'antiAir',first.col,first.row).ok,false);
  assert.equal(build(state,'mine',path.col,path.row).ok,true);
  assert.equal(state.supply,state.config.startSupply-155);
});

test('улучшения турелей и продажа возвращают 60% суммарных затрат',()=>{
  const m=createMission('sector-02'),p=m.config.map.buildCells[0],t=build(m,'pulse',p.col,p.row).item;
  assert.equal(upgrade(m,t.id).ok,true);
  assert.equal(upgrade(m,t.id).ok,true);
  assert.equal(upgrade(m,t.id).ok,false);
  const refund=sell(m,t.id);
  assert.equal(refund.refund,Math.floor((160+115+170)*.6));
  assert.equal(m.towers.length,0);
});

test('разведдрон движется по команде и имеет лимит 2 активных',()=>{
  const m=createMission('sector-03'),cells=m.config.map.buildCells;
  const u1=build(m,'drone',cells[0].col,cells[0].row).item;
  assert.equal(build(m,'drone',cells[1].col,cells[1].row).ok,true);
  assert.equal(build(m,'drone',cells[2].col,cells[2].row).ok,false);
  const before={x:u1.x,y:u1.y};
  assert.equal(commandDrone(m,u1.id,before.x+3,before.y).ok,true);
  startWave(m);for(let i=0;i<60;i++)updateMission(m,1/60);
  assert.ok(u1.x>before.x);
});

test('ловушки срабатывают по наземным врагам и исчезают после разряда',()=>{
  const m=createMission('sector-03');
  const cell=m.config.map.trapCells[0];
  assert.equal(build(m,'mine',cell.col,cell.row).ok,true);
  startWave(m);for(let i=0;i<260;i++)updateMission(m,1/60);
  assert.equal(m.traps.length,0);
});

test('у каждого типа миссии своя научная цель',()=>{
  const seen=new Set();
  for(const id of MISSION_IDS){
    const m=createMission(id);
    seen.add(m.config.objective.type);
    assert.equal(objectiveProgress(m),0);
  }
  assert.deepEqual([...seen].sort(),['defend','escort','hold','remote']);
});

test('звёзды учитывают HP защищаемых объектов и результат вылазки',()=>{
  const m=createMission('sector-01');
  assert.equal(calculateStars(m),0);
  m.phase='victory';
  assert.equal(calculateStars(m),3);
  m.targetHp=110;m.targetDamage=90;
  assert.equal(calculateStars(m),1);
  m.targetHp=140;m.targetDamage=60;
  assert.equal(calculateStars(m),2);
  const escort=createMission('sector-06');escort.phase='victory';
  escort.destroyedDrones=1;
  assert.equal(calculateStars(escort),2);
});

test('первая миссия полностью проходима с 400 ЭС без предварительного фарма',()=>{
  const m=createMission('sector-01');
  for(const [col,row] of [[2,4],[7,2],[10,6],[15,6]])assert.equal(build(m,'kinetic',col,row).ok,true);
  let steps=0;
  for(let wave=0;wave<3;wave++){
    assert.equal(startWave(m).ok,true);
    while(m.phase==='combat'&&steps<14000){updateMission(m,1/60);steps++;}
    assert.notEqual(m.phase,'defeat');
  }
  assert.equal(m.phase,'victory');
  assert.equal(m.kills,25);
  assert.equal(m.stars,3);
  assert.equal(m.targetHp,200);
});

test('запрет двойного запуска волны и изменение времени только в combat',()=>{
  const m=createMission('sector-02');
  assert.equal(startWave(m).ok,true);
  assert.equal(startWave(m).ok,false);
  const time=m.time;
  updateMission(m,1/60);assert.ok(m.time>time);
  m.phase='intermission';const before=m.time;updateMission(m,5);
  assert.equal(m.time,before);
});

test('UI содержит все точки динамического управления шестью секторами',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  for(const match of js.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(match[1]),'Missing element '+match[1]);
  assert.ok(ids.has('sectorNodes'));
  assert.ok(ids.has('equipmentList'));
  assert.ok(ids.has('objectives'));
});
