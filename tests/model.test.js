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

test('24 законченных сектора в восьми биомах с валидными маршрутами',()=>{
  assert.equal(validateContent(),true);
  assert.equal(MISSION_IDS.length,24);
  assert.equal(new Set(MISSION_IDS.map(id=>MISSIONS[id].biome)).size,8);
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

test('карта прогрессии: 24 последовательные победы завершают планетарную кампанию',()=>{
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
  assert.equal(p.unlockedSectorIds.length,24);
  assert.deepEqual(unlockedEquipment(p).towers,['kinetic','pulse','mortar','antiAir','cryo','sonic']);
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
  assert.equal(migrated.schemaVersion,3);
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
  assert.deepEqual([...seen].sort(),['defend','escort','hold','relay','remote']);
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
  for(const id of ['screen-archive','screen-settings','archiveSectors','archiveEnemies',
    'musicVolume','sfxVolume','reducedMotion','commandButton'])assert.ok(ids.has(id),id);
});


test('первая глава 01–06 проходима подряд без обязательного повторного фарма',()=>{
  const p=newProgress();
  const strategies={
    'sector-01':{initial:['kinetic','kinetic','kinetic','kinetic'],between:['kinetic']},
    'sector-02':{initial:['pulse','pulse','kinetic','kinetic'],between:['pulse']},
    'sector-03':{initial:['pulse','pulse','kinetic','drone'],between:['pulse']},
    'sector-04':{initial:['mortar','pulse','pulse','kinetic','kinetic'],between:['mortar']},
    'sector-05':{initial:['antiAir:exit','antiAir','antiAir','pulse:exit','kinetic:exit'],between:['antiAir:exit','pulse:exit']},
    'sector-06':{initial:['antiAir','antiAir:exit','pulse','kinetic','drone:team'],between:['pulse:team','mortar','antiAir:exit']}
  };
  for(const id of MISSION_IDS.slice(0,6)){
    assert.ok(p.unlockedSectorIds.includes(id),'Сектор должен быть доступен: '+id);
    const m=createMission(id),plan=strategies[id];
    function place(option){
      const [type,focus='spread']=option.split(':');
      const spec=TOWERS[type]||UNITS[type],routes=m.config.map.routes;
      const road=type==='antiAir'?(routes.air||routes.west):routes.west;
      const choices=m.config.map.buildCells.filter(t=>canBuild(m,type,t.col,t.row).ok);
      if(!choices.length)return false;
      let choice=null,max=-Infinity;
      for(const c of choices){
        const coverage=road.reduce((sum,t)=>sum+(Math.hypot(c.col-t.col,c.row-t.row)<=(spec.range||3)+.4?1:0),0);
        const neighbors=m.towers.filter(t=>t.type===type).reduce((sum,t)=>sum+Math.max(0,5-Math.hypot(c.col-t.col,c.row-t.row)),0);
        const exit=road.at(-1),exitDist=Math.hypot(c.col-exit.col,c.row-exit.row);
        const teamDist=m.team?Math.hypot(c.col-m.team.position.x,c.row-m.team.position.y):0;
        const score=coverage*2-neighbors*8+(focus==='exit'?-exitDist*3:focus==='team'?-teamDist*3:0);
        if(score>max){max=score;choice=c;}
      }
      return build(m,type,choice.col,choice.row).ok;
    }
    for(const item of plan.initial)assert.equal(place(item),true,id+': невозможно построить '+item);
    let steps=0;
    for(let wave=0;wave<m.config.waves.length;wave++){
      assert.equal(startWave(m).ok,true);
      while(m.phase==='combat'&&steps<19000){updateMission(m,1/60);steps++;}
      assert.notEqual(m.phase,'defeat',id+' волна '+(wave+1)+': '+m.outcomeReason);
      if(m.phase==='intermission')for(const item of plan.between)place(item);
    }
    assert.equal(m.phase,'victory',id+' должен закончиться победой, а не '+m.phase);
    assert.ok(m.stars>=1);
    grantVictory(p,id,m.stars);
  }
  assert.equal(campaignComplete(p),false);
  assert.equal(p.sectors['sector-06'].victories,1);
  assert.ok(p.unlockedSectorIds.includes('sector-07'));
});


test('сохранение звуковых настроек и уменьшения анимаций',()=>{
  const p=newProgress();
  p.settings={musicVolume:.35,sfxVolume:.15,reducedMotion:true};
  const q=sanitizeProgress(p);
  assert.equal(q.settings.musicVolume,.35);
  assert.equal(q.settings.sfxVolume,.15);
  assert.equal(q.settings.reducedMotion,true);
});
test('аудиомодуль изолирован от игровой симуляции и корректно работает без Web Audio',async()=>{
  const {AudioDirector}=await import('../src/audio.js');
  const audio=new AudioDirector(()=>({musicVolume:0,sfxVolume:0}));
  assert.doesNotThrow(()=>audio.cue('wave'));
  assert.doesNotThrow(()=>audio.cue('victory'));
  audio.dispose();
});


test('расширенная кампания: все 24 миссии имеют уникальный контент, а все биомы достижимы',()=>{
  assert.deepEqual(MISSION_IDS,[...Array(24)].map((_,i)=>'sector-'+String(i+1).padStart(2,'0')));
  assert.equal(new Set(MISSION_IDS.map(id=>MISSIONS[id].name)).size,24);
  assert.equal(new Set(MISSION_IDS.map(id=>MISSIONS[id].biome)).size,8);
  assert.equal(Object.keys(ENEMIES).length>=11,true);
  assert.equal(Object.keys(TOWERS).length,6);
  assert.equal(Object.keys(TRAPS).length,3);
  assert.equal(Object.keys(UNITS).length,3);
  for(const id of MISSION_IDS.slice(6)){
    const m=MISSIONS[id];
    assert.equal(m.briefing.length,4,id+' briefing');
    assert.ok(m.waves.length>=4,id+' waves');
    assert.ok(m.allowed.towers.length>=5,id+' defenses');
    assert.ok(m.map.buildCells.length>20,id+' build slots');
    assert.ok(m.stars.length===3,id+' stars');
    assert.ok(m.rewards.materials>0 && m.rewards.firstMaterials>0);
  }
});
test('загрузка схемы v2 сохраняет прежние победы и открывает сектор 07',()=>{
  const old=newProgress();
  old.schemaVersion=2;
  for(const id of MISSION_IDS.slice(0,6)){old.sectors[id].victories=1;old.sectors[id].bestStars=2;}
  old.resources.materials=1900;old.research.precision=true;
  old.sectors['sector-07']=undefined;
  const next=sanitizeProgress(old);
  assert.equal(next.schemaVersion,3);
  assert.equal(next.sectors['sector-06'].bestStars,2);
  assert.ok(next.unlockedSectorIds.includes('sector-07'));
  assert.equal(next.sectors['sector-24'].victories,0);
  assert.equal(next.resources.materials,1900);
});
test('три ретранслятора активируются по очереди, прогресс меняется только в бою',()=>{
  const mission=createMission('sector-08');
  assert.equal(mission.config.objective.type,'relay');
  assert.equal(mission.relayIndex,0);
  assert.equal(objectiveProgress(mission),0);
  startWave(mission);
  for(let i=0;i<1300;i++)updateMission(mission,1/60);
  assert.ok(mission.relayIndex>=1,'первый ретранслятор активирован');
  const last=mission.science;
  mission.phase='intermission';
  for(let i=0;i<120;i++)updateMission(mission,1/60);
  assert.equal(mission.science,last,'в межволновой паузе наука останавливается');
});
test('новые устройства: крио, резонатор, акустическая приманка и ремонтный бот',()=>{
  const state=createMission('sector-20');
  const area=state.config.map.buildCells;
  assert.equal(build(state,'cryo',area[0].col,area[0].row).ok,true);
  assert.equal(build(state,'sonic',area[1].col,area[1].row).ok,true);
  assert.equal(build(state,'repair',area[2].col,area[2].row).ok,true);
  const trap=state.config.map.trapCells[0];
  assert.equal(build(state,'lure',trap.col,trap.row).ok,true);
  assert.equal(state.units[0].type,'repair');
  const moved=commandDrone(state,state.units[0].id,10,10);
  assert.equal(moved.ok,true);
});
test('вся кампания 07–24 проходима после 06 без ресурсов лагеря',()=>{
  const p=newProgress();
  // Предыдущие сектора уже пройдены без дополнительного фарма.
  for(const id of MISSION_IDS.slice(0,6))grantVictory(p,id,1);
  const startingMaterials=p.resources.materials;
  const routeFor=(m,type)=>{
    if(type==='antiAir')return [['air',m.config.map.routes.air||m.config.map.routes.west]];
    return Object.entries(m.config.map.routes).filter(([name])=>type==='sonic'||name!=='air');
  };
  for(const id of MISSION_IDS.slice(6)){
    assert.ok(p.unlockedSectorIds.includes(id),id+' доступен');
    const state=createMission(id);const hasAir=!!state.config.map.routes.air;
    function place(type){
      if(!state.config.allowed.towers.includes(type))return false;
      const spec=TOWERS[type],routes=routeFor(state,type);
      let target=null,best=-Infinity;
      for(const site of state.config.map.buildCells){
        if(!canBuild(state,type,site.col,site.row).ok)continue;
        const coverage=routes.reduce((total,[routeId,route])=>total+
          route.reduce((n,t)=>n+(Math.hypot(t.col-site.col,t.row-site.row)<=spec.range+.4?
            (routeId==='north'?1.4:1):0),0),0);
        const crowd=state.towers.filter(t=>t.type===type).reduce((n,t)=>
          n+Math.max(0,6-Math.hypot(t.col-site.col,t.row-site.row)),0);
        const goalDistance=Math.hypot(site.col-state.config.map.target.x,site.row-state.config.map.target.y);
        const score=coverage*2-crowd*8-goalDistance*.12;
        if(score>best){best=score;target=site;}
      }
      return target?build(state,type,target.col,target.row).ok:false;
    }
    const opening=hasAir?['antiAir','antiAir','antiAir','antiAir','pulse','pulse','pulse','sonic','sonic','mortar','cryo']:
      ['pulse','pulse','pulse','pulse','mortar','mortar','sonic','sonic','cryo','kinetic'];
    for(const type of opening)place(type);
    let steps=0;
    for(let wave=0;wave<state.config.waves.length;wave++){
      assert.equal(startWave(state).ok,true);
      while(state.phase==='combat'&&steps<26000){updateMission(state,1/60);steps++;}
      assert.notEqual(state.phase,'defeat',id+' wave '+(wave+1));
      if(state.phase==='intermission'){
        const reinforcement=hasAir?['antiAir','sonic','pulse','antiAir','pulse','mortar','sonic','pulse']:
          ['pulse','sonic','mortar','pulse','sonic','pulse'];
        reinforcement.forEach(place);
      }
    }
    assert.equal(state.phase,'victory',id+' victory');
    assert.ok(state.stars>=1,id+' star');
    grantVictory(p,id,state.stars);
  }
  assert.equal(campaignComplete(p),true);
  assert.equal(p.unlockedSectorIds.length,24);
  assert.equal(MISSION_IDS.reduce((n,id)=>n+p.sectors[id].bestStars,0)>=24,true);
  assert.ok(p.resources.materials>startingMaterials,'первые победы выдают ресурсы');
});
