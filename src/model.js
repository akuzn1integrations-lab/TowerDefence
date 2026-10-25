import {
  CELL, GRID, GENERATOR, SPAWN, TURRET, ENEMY, WAVES, ROUTE,
  BUILD_KEYS, PATH_KEYS, SUPPLY_START, WAVE_BONUS, INSTALL_SECONDS,
  cellKey, center
} from './config.js';

const DISTANCE_EPSILON = 0.00001;
const ALLOWED_PHASES = new Set(['preparation', 'combat', 'intermission']);
export function createMission({ damageBonus = 0 } = {}) {
  return {
    phase: 'preparation', time: 0, waveIndex: -1, wave: null,
    supply: SUPPLY_START, targetHp: GENERATOR.maxHp, damageTaken: 0,
    installTime: 0, towers: [], enemies: [], shots: [],
    nextTowerId: 1, nextEnemyId: 1,
    kills: 0, stars: 0, outcomeReason: '',
    damageBonus: Number.isFinite(damageBonus) ? damageBonus : 0
  };
}
export function missionProgress(state) {
  return Math.min(100, Math.round(100 * state.installTime / INSTALL_SECONDS));
}
export function enemyPosition(enemy) {
  const a = ROUTE[Math.min(ROUTE.length-1, Math.floor(enemy.progress))];
  const b = ROUTE[Math.min(ROUTE.length-1, Math.floor(enemy.progress)+1)];
  const t = Math.min(1, enemy.progress - Math.floor(enemy.progress));
  return { x: a.col + 0.5 + (b.col-a.col)*t, y: a.row + 0.5 + (b.row-a.row)*t };
}
// BFS отдельной функцией для проверок блокировки и будущих карт.
export function hasGroundPath(blocked = new Set()) {
  const from = cellKey(SPAWN.col, SPAWN.row);
  const goal = cellKey(GENERATOR.col, GENERATOR.row);
  if (blocked.has(from) || blocked.has(goal)) return false;
  const queue = [SPAWN], seen = new Set([from]);
  for (let i=0; i<queue.length; i++) {
    const {col,row} = queue[i];
    if (col === GENERATOR.col && row === GENERATOR.row) return true;
    for (const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc=col+dc,nr=row+dr,k=cellKey(nc,nr);
      if (nc<0 || nr<0 || nc>=GRID.width || nr>=GRID.height) continue;
      if (!PATH_KEYS.has(k) || blocked.has(k) || seen.has(k)) continue;
      seen.add(k); queue.push({col:nc,row:nr});
    }
  }
  return false;
}
export function validateBuild(state, col, row) {
  if (!ALLOWED_PHASES.has(state.phase)) return {ok:false,reason:'Миссия уже завершена'};
  if (!Number.isInteger(col) || !Number.isInteger(row) || col<0 || row<0 || col>=GRID.width || row>=GRID.height) {
    return {ok:false,reason:'Клетка вне карты'};
  }
  const key=cellKey(col,row);
  if (PATH_KEYS.has(key)) return {ok:false,reason:'Перекрыт путь: строить на маршруте нельзя'};
  if (!BUILD_KEYS.has(key)) return {ok:false,reason:'Строить можно только на светящихся площадках'};
  if (state.towers.some(t=>t.col===col && t.row===row)) return {ok:false,reason:'Площадка уже занята'};
  if (state.supply < TURRET.cost[0]) return {ok:false,reason:'Недостаточно энергии снабжения'};
  const occupied = new Set(state.towers.map(t=>cellKey(t.col,t.row)));
  occupied.add(key);
  if (!hasGroundPath(occupied)) return {ok:false,reason:'Перекрыт путь'};
  return {ok:true};
}
export function placeTower(state, col, row) {
  const check=validateBuild(state,col,row);
  if (!check.ok) return check;
  const tower = { id:state.nextTowerId++, col, row, level:1, cooldown:0, spent:TURRET.cost[0] };
  state.towers.push(tower);
  state.supply -= TURRET.cost[0];
  return {ok:true,tower};
}
export function upgradeTower(state, id) {
  if (!ALLOWED_PHASES.has(state.phase)) return {ok:false,reason:'Миссия завершена'};
  const tower=state.towers.find(t=>t.id===id);
  if (!tower) return {ok:false,reason:'Башня не найдена'};
  if (tower.level>=3) return {ok:false,reason:'Максимальный уровень'};
  const price=TURRET.cost[tower.level];
  if (state.supply<price) return {ok:false,reason:'Недостаточно энергии'};
  state.supply-=price;
  tower.spent+=price;
  tower.level++;
  return {ok:true,tower};
}
export function sellTower(state,id) {
  if (!ALLOWED_PHASES.has(state.phase)) return {ok:false,reason:'Миссия завершена'};
  const index=state.towers.findIndex(t=>t.id===id);
  if (index<0) return {ok:false,reason:'Башня не найдена'};
  const [tower]=state.towers.splice(index,1);
  const refund=Math.floor(tower.spent*0.6);
  state.supply+=refund;
  return {ok:true,refund};
}
export function startWave(state) {
  if (state.phase!=='preparation' && state.phase!=='intermission') {
    return {ok:false,reason:'Невозможно запустить волну сейчас'};
  }
  if (state.waveIndex + 1 >= WAVES.length) return {ok:false,reason:'Все волны завершены'};
  state.waveIndex++;
  state.wave = { spawned:0, elapsed:0, nextSpawnAt:0 };
  state.phase='combat';
  return {ok:true,number:state.waveIndex+1};
}
function spawnEnemy(state) {
  state.enemies.push({
    id:state.nextEnemyId++, hp:ENEMY.maxHp, maxHp:ENEMY.maxHp,
    progress:0, contact:false
  });
}
function killEnemy(state, enemy, source) {
  if (enemy.hp<=0) return;
  enemy.hp=0;
  state.supply+=ENEMY.reward;
  state.kills++;
  if (source) state.shots.push({x:source.col+0.5,y:source.row+0.5,target:enemyPosition(enemy),life:0.16});
}
function fireTurrets(state, dt) {
  for (const tower of state.towers) {
    tower.cooldown -= dt;
    const spec=TURRET.levels[tower.level-1];
    const range=TURRET.range * spec.rangeMultiplier;
    const potential=state.enemies
      .filter(enemy => enemy.hp>0 && (() => {
        const p=enemyPosition(enemy);
        return Math.hypot(p.x-(tower.col+0.5),p.y-(tower.row+0.5)) <= range + DISTANCE_EPSILON;
      })())
      .sort((a,b) => b.progress-a.progress || a.id-b.id);
    if (!potential.length) {
      tower.cooldown=Math.min(tower.cooldown,0);
      continue;
    }
    const fireRate=TURRET.shotsPerSecond*(spec.shotsMultiplier || 1);
    while (tower.cooldown <= 0) {
      const victim=potential.find(enemy=>enemy.hp>0);
      if (!victim) break;
      const damage=TURRET.damage*spec.damageMultiplier*(1+state.damageBonus);
      const hit=enemyPosition(victim);
      victim.hp=Math.max(0,victim.hp-damage);
      state.shots.push({x:tower.col+0.5,y:tower.row+0.5,target:hit,life:0.16});
      if (victim.hp===0) {
        // Изменяем hp до вызова, поэтому начисляем награду непосредственно здесь.
        state.supply+=ENEMY.reward;
        state.kills++;
      }
      tower.cooldown += 1/fireRate;
    }
  }
}
export function calculateStars(state) {
  if (state.phase!=='victory') return 0;
  const fraction=state.targetHp / GENERATOR.maxHp;
  return 1 + (fraction >= 0.6 - DISTANCE_EPSILON ? 1 : 0) +
    (state.damageTaken < DISTANCE_EPSILON ? 1 : 0);
}
export function updateMission(state, dt) {
  if (state.phase!=='combat' || !Number.isFinite(dt) || dt<=0) return;
  dt=Math.min(dt,0.1);
  state.time+=dt;
  state.installTime=Math.min(INSTALL_SECONDS,state.installTime+dt);
  state.shots=state.shots.filter(shot=> (shot.life-=dt)>0);
  const waveData=WAVES[state.waveIndex];
  if (state.wave) {
    state.wave.elapsed+=dt;
    while (state.wave.spawned<waveData.count && state.wave.elapsed+DISTANCE_EPSILON>=state.wave.nextSpawnAt) {
      spawnEnemy(state);
      state.wave.spawned++;
      state.wave.nextSpawnAt=state.wave.spawned*waveData.interval;
    }
  }
  for (const enemy of state.enemies) {
    if (enemy.hp<=0) continue;
    enemy.progress=Math.min(ROUTE.length-1,enemy.progress + ENEMY.speed*dt);
    if (enemy.progress >= ROUTE.length-1-DISTANCE_EPSILON) {
      enemy.contact=true;
      const damage=Math.min(state.targetHp,ENEMY.contactDps*dt);
      state.targetHp-=damage;
      state.damageTaken+=damage;
    }
  }
  if (state.targetHp<=0) {
    state.targetHp=0; state.phase='defeat'; state.outcomeReason='Генератор уничтожен';
    return;
  }
  fireTurrets(state,dt);
  state.enemies=state.enemies.filter(enemy=>enemy.hp>0);
  if (state.wave && state.wave.spawned===waveData.count && state.enemies.length===0) {
    state.wave=null;
    state.supply+=WAVE_BONUS;
    if (state.waveIndex < WAVES.length-1) {
      state.phase='intermission';
    }
  }
  if (state.waveIndex===WAVES.length-1 && state.wave===null &&
      state.enemies.length===0 && state.installTime>=INSTALL_SECONDS-DISTANCE_EPSILON) {
    state.phase='victory';
    state.stars=calculateStars(state);
  }
}
export function towerAt(state,col,row) { return state.towers.find(t=>t.col===col && t.row===row) || null; }
export function getSupplySpent(tower) { return tower.spent; }
export function towerRange(tower) { return TURRET.range*TURRET.levels[tower.level-1].rangeMultiplier; }
export function remainingWaves(state) { return WAVES.length - (state.waveIndex + 1); }
export function totalRoadDistance() { return (ROUTE.length-1)*CELL; }
