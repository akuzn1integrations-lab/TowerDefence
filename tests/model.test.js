import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILD_CELLS, ROUTE, ENEMY, TURRET } from '../src/config.js';
import {
  createMission, placeTower, validateBuild, hasGroundPath,
  upgradeTower, sellTower, startWave, updateMission, calculateStars
} from '../src/model.js';
import {
  newProgress, grantVictory, purchaseResearch, sanitizeProgress,
  storeProgress, loadProgress, SAVE_KEY
} from '../src/progress.js';

test('маршрут от входа до генератора достижим, строительные места не пересекаются с дорогой',()=>{
  assert.equal(hasGroundPath(),true);
  assert.equal(BUILD_CELLS.length,18);
  const keys=new Set(ROUTE.map(c=>c.col+':'+c.row));
  for(const cell of BUILD_CELLS) assert.equal(keys.has(cell.col+':'+cell.row),false);
});
test('строительство: проверка пути, цены и повторного размещения',()=>{
  const m=createMission();
  assert.equal(validateBuild(m,4,5).ok,false);
  assert.match(validateBuild(m,4,5).reason,/путь/i);
  assert.equal(placeTower(m,2,4).ok,true);
  assert.equal(m.supply,300);
  assert.equal(placeTower(m,2,4).ok,false);
  assert.equal(m.supply,300);
  assert.equal(placeTower(m,-1,99).ok,false);
});
test('улучшение/продажа: корректная стоимость, верхний предел, возврат 60%',()=>{
  const m=createMission();
  const tower=placeTower(m,2,4).tower;
  assert.equal(upgradeTower(m,tower.id).ok,true);
  assert.equal(m.supply,220);
  assert.equal(upgradeTower(m,tower.id).ok,true);
  assert.equal(m.supply,95);
  assert.equal(upgradeTower(m,tower.id).ok,false);
  const refund=sellTower(m,tower.id);
  assert.equal(refund.refund,Math.floor((100+80+125)*.6));
  assert.equal(m.towers.length,0);
});
test('волна создаёт точное количество врагов по игровому времени',()=>{
  const m=createMission();
  assert.equal(startWave(m).ok,true);
  updateMission(m,1/60);
  assert.equal(m.enemies.length,1);
  for(let i=0;i<125;i++) updateMission(m,1/60);
  assert.equal(m.enemies.length,2);
  assert.equal(m.wave.spawned,2);
});
test('звёзды: победа обязательна, лучшая оценка зависит от состояния базы',()=>{
  const m=createMission();
  assert.equal(calculateStars(m),0);
  m.phase='victory';
  assert.equal(calculateStars(m),3);
  m.targetHp=110;m.damageTaken=90;
  assert.equal(calculateStars(m),1);
  m.targetHp=150;m.damageTaken=50;
  assert.equal(calculateStars(m),2);
});
test('первый бонус не начисляется повторно, лучшие звёзды не снижаются',()=>{
  const p=newProgress();
  const first=grantVictory(p,3);
  assert.deepEqual(first,{materials:500,data:50,first:true});
  assert.equal(p.sectors['sector-01'].bestStars,3);
  const second=grantVictory(p,1);
  assert.deepEqual(second,{materials:180,data:20,first:false});
  assert.equal(p.resources.materials,680);
  assert.equal(p.sectors['sector-01'].bestStars,3);
  assert.deepEqual(p.unlockedSectorIds,['sector-01','sector-02']);
});
test('технология покупается только один раз, ресурс не уходит ниже нуля',()=>{
  const p=newProgress();
  assert.equal(purchaseResearch(p,'precision').ok,false);
  grantVictory(p,1);
  assert.equal(purchaseResearch(p,'precision').ok,true);
  assert.equal(p.resources.materials,250);
  assert.equal(p.research.precision,true);
  assert.equal(purchaseResearch(p,'precision').ok,false);
  assert.equal(p.resources.materials,250);
});
test('сохранение переживает перезагрузку и обрабатывает повреждения',()=>{
  const fakeStorage=new Map();
  const storage={getItem:k=>fakeStorage.get(k)||null,setItem:(k,v)=>fakeStorage.set(k,v)};
  const p=newProgress();
  grantVictory(p,2);
  assert.equal(storeProgress(p,storage),true);
  const actual=loadProgress(storage).progress;
  assert.equal(actual.resources.materials,500);
  assert.equal(actual.sectors['sector-01'].bestStars,2);
  assert.equal(actual.research.precision,false);
  fakeStorage.set(SAVE_KEY,'{');
  assert.match(loadProgress(storage).warning,/сохранение/i);
  const patched=sanitizeProgress({schemaVersion:1,resources:{materials:-100,data:Infinity}});
  assert.equal(patched.resources.materials,0);
});
test('три волны можно выиграть на базовом снаряжении без обязательного фарма',()=>{
  const m=createMission();
  for(const [col,row] of [[2,4],[7,2],[10,6],[15,6]]) {
    assert.equal(placeTower(m,col,row).ok,true);
  }
  let steps=0;
  for(let number=0;number<3;number++){
    assert.equal(startWave(m).ok,true);
    while(m.phase==='combat' && steps<18000){
      updateMission(m,1/60);
      steps++;
    }
    assert.notEqual(m.phase,'defeat','Генератор не должен быть уничтожен');
  }
  assert.equal(m.phase,'victory','Последняя волна и монтаж должны завершиться победой');
  assert.ok(m.stars>=1);
  assert.equal(m.kills,25);
  assert.ok(m.targetHp>0);
  assert.ok(m.supply>=0);
});
