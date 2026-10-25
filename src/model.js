import { MISSIONS, ENEMIES, TOWERS, TRAPS, UNITS, cellKey, center } from './config.js';

const EPS=1e-7;
const live=s=>['preparation','intermission','combat'].includes(s.phase);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const fromCell=(c)=>({x:c.col+.5,y:c.row+.5});
export function createMission(id='sector-01', bonuses={}){
  const config=MISSIONS[id];
  if(!config)throw Error('Unknown mission '+id);
  return {
    id, config, phase:'preparation', time:0, waveIndex:-1, wave:null,
    supply:config.startSupply+(bonuses.logistics?100:0),
    targetHp:config.objective.maxHp, targetDamage:0, science:0,
    towers:[], traps:[], units:[], enemies:[], effects:[], nextId:1, kills:0,
    paused:false, stars:0, outcomeReason:'', deployedDrones:0, destroyedDrones:0,
    bonuses:{precision:!!bonuses.precision,capacitor:!!bonuses.capacitor,logistics:!!bonuses.logistics},
    team:config.objective.groupHp?{
      hp:config.objective.groupHp,maxHp:config.objective.groupHp,progress:0,stopsDone:[],
      position:fromCell(config.map.researchPath[0]),working:0,atDestination:false,damageTaken:0
    }:null
  };
}
const keys=cells=>new Set(cells.map(c=>cellKey(c.col,c.row)));
export function canBuild(state,type,col,row){
  if(!live(state))return {ok:false,reason:'Миссия закончена'};
  if(!Number.isInteger(col)||!Number.isInteger(row))return {ok:false,reason:'Неверные координаты'};
  if(col<0||row<0||col>=state.config.map.width||row>=state.config.map.height)return {ok:false,reason:'Вне карты'};
  const kind=TOWERS[type]?'tower':TRAPS[type]?'trap':UNITS[type]?'unit':null;
  if(!kind)return {ok:false,reason:'Неизвестное устройство'};
  if(!state.config.allowed[kind==='tower'?'towers':kind==='trap'?'traps':'units'].includes(type))return {ok:false,reason:'Устройство ещё недоступно'};
  const equipment=kind==='tower'?TOWERS[type]:kind==='trap'?TRAPS[type]:UNITS[type];
  if(state.supply<equipment.cost[0] && kind==='tower' || state.supply<(kind==='tower'?equipment.cost[0]:equipment.cost))return {ok:false,reason:'Недостаточно энергии снабжения'};
  const key=cellKey(col,row);
  const road=keys(Object.values(state.config.map.routes).flat());
  if(kind==='tower'){
    if(road.has(key))return {ok:false,reason:'Перекрыт маршрут врагов'};
    if(!keys(state.config.map.buildCells).has(key))return {ok:false,reason:'Только на светящихся строительных площадках'};
    if(state.towers.some(o=>o.col===col&&o.row===row))return {ok:false,reason:'Площадка занята'};
    if(!hasGroundPaths(state,{col,row}))return {ok:false,reason:'Нельзя перекрыть путь'};
  }else if(kind==='trap'){
    if(!keys(state.config.map.trapCells).has(key))return {ok:false,reason:'Ловушка ставится только на тропу'};
    if(state.traps.some(o=>o.col===col&&o.row===row))return {ok:false,reason:'Здесь уже стоит ловушка'};
  }else{
    if(type==='drone' && state.units.filter(u=>u.type==='drone'&&u.hp>0).length>=UNITS.drone.limit)return {ok:false,reason:'Лимит: 2 активных дрона'};
  }
  return {ok:true};
}
// Every built tower is placed off traversable tracks. Validate all ground spawns and endings.
export function hasGroundPaths(state,extra=null){
  const {routes}=state.config.map;
  const blocked=keys(state.towers.concat(extra?[extra]:[]));
  for(const route of Object.entries(routes)){
    if(ENEMIES.flyer.air && route[0]==='air')continue;
    const cells=route[1];
    if(cells.some(c=>blocked.has(cellKey(c.col,c.row))))return false;
    for(let i=1;i<cells.length;i++)if(Math.abs(cells[i].col-cells[i-1].col)+Math.abs(cells[i].row-cells[i-1].row)!==1)return false;
  }
  return true;
}
export function build(state,type,col,row){
  const valid=canBuild(state,type,col,row);if(!valid.ok)return valid;
  const base=TOWERS[type]||TRAPS[type]||UNITS[type],kind=TOWERS[type]?'tower':TRAPS[type]?'trap':'unit';
  const price=kind==='tower'?base.cost[0]:base.cost;
  const item={id:state.nextId++,type,col,row};
  if(kind==='tower'){Object.assign(item,{level:1,cooldown:0,spent:price});state.towers.push(item);}
  else if(kind==='trap'){Object.assign(item,{charges:base.charges,affected:new Set()});state.traps.push(item);}
  else{Object.assign(item,{x:col+.5,y:row+.5,to:{x:col+.5,y:row+.5},hp:base.maxHp,maxHp:base.maxHp,cooldown:0});state.units.push(item);state.deployedDrones++;}
  state.supply-=price;
  return {ok:true,item};
}
export function upgrade(state,id){
  if(!live(state))return {ok:false,reason:'Миссия завершена'};
  const tower=state.towers.find(t=>t.id===id);
  if(!tower)return {ok:false,reason:'Башня не найдена'};
  if(tower.level===3)return {ok:false,reason:'Максимальный уровень'};
  const price=TOWERS[tower.type].cost[tower.level];
  if(state.supply<price)return {ok:false,reason:'Недостаточно энергии'};
  state.supply-=price;tower.spent+=price;tower.level++;
  return {ok:true};
}
export function sell(state,id){
  if(!live(state))return {ok:false,reason:'Миссия завершена'};
  const i=state.towers.findIndex(t=>t.id===id);
  if(i<0)return {ok:false,reason:'Башня не найдена'};
  const [tower]=state.towers.splice(i,1),refund=Math.floor(tower.spent*.6);
  state.supply+=refund;return {ok:true,refund};
}
export function commandDrone(state,id,x,y){
  const unit=state.units.find(u=>u.id===id&&u.hp>0);
  if(!unit)return {ok:false,reason:'Дрон недоступен'};
  if(!Number.isFinite(x)||!Number.isFinite(y))return {ok:false,reason:'Неверная точка'};
  unit.to={x:Math.max(.5,Math.min(state.config.map.width-.5,x)),
           y:Math.max(.5,Math.min(state.config.map.height-.5,y))};
  return {ok:true};
}
export function startWave(state){
  if(!['preparation','intermission'].includes(state.phase))return {ok:false,reason:'Сейчас нельзя начать волну'};
  if(state.waveIndex+1>=state.config.waves.length)return {ok:false,reason:'Все волны пройдены'};
  state.waveIndex++;
  state.wave={elapsed:0,groups:state.config.waves[state.waveIndex].groups.map(g=>({...g,spawned:0}))};
  state.phase='combat';return {ok:true};
}
function spawn(state,g){
  const def=ENEMIES[g.type],r=state.config.map.routes[g.route];
  state.enemies.push({id:state.nextId++,type:g.type,route:g.route,progress:0,
    x:r[0].col+.5,y:r[0].row+.5,hp:def.hp,maxHp:def.hp,
    slowed:0,slowAmount:0,chasing:false,contactTime:0,alive:true});
}
function inflict(state,e,amount,kind='kinetic',piercing=0){
  if(!e.alive || amount<=0)return false;
  const resist=kind==='kinetic'?ENEMIES[e.type].kinetic*(1-piercing):0;
  const damage=Math.max(1,Math.round(amount*(1-resist)*100)/100);
  e.hp=Math.max(0,e.hp-damage);
  if(e.hp<=0){e.alive=false;state.supply+=ENEMIES[e.type].reward;state.kills++;return true;}
  return false;
}
function splash(state,x,y,damage,radius,kind,piercing=0){
  for(const e of state.enemies)if(e.alive&&!ENEMIES[e.type].air&&dist({x,y},e)<=radius+EPS)inflict(state,e,damage,kind,piercing);
}
function doAttack(state,source,enemy,damage,kind,piercing=0,area=0){
  const x=enemy.x,y=enemy.y;
  if(area)splash(state,x,y,damage,area,kind,piercing);
  else inflict(state,enemy,damage,kind,piercing);
  state.effects.push({x:source.x,y:source.y,tx:x,ty:y,life:.14});
}
function rangeFor(t){return TOWERS[t.type].range*(t.level>=2?1.1:1);}
function damageFor(state,t){
  const d=TOWERS[t.type],lv=t.level===3?1.625:t.level===2?1.25:1;
  return d.damage*lv*(d.kind==='kinetic'&&state.bonuses.precision?1.1:1)*
    (d.kind==='energy'&&state.bonuses.capacitor?1.15:1);
}
export function towerRange(t){return rangeFor(t);}
function shoot(state,dt){
  for(const t of state.towers){
    const info=TOWERS[t.type],origin={x:t.col+.5,y:t.row+.5},range=rangeFor(t);
    t.cooldown=Math.max(-.05,t.cooldown-dt);
    if(t.cooldown>0)continue;
    const enemies=state.enemies.filter(e=>e.alive&&
      (info.targets==='air')===ENEMIES[e.type].air&&
      dist(origin,e)<=range+EPS&&dist(origin,e)>=(info.minRange||0)-EPS);
    enemies.sort((a,b)=>b.progress-a.progress||a.id-b.id);
    if(!enemies.length)continue;
    doAttack(state,origin,enemies[0],damageFor(state,t),info.kind,info.piercing||0,info.splash||0);
    t.cooldown=1/(info.rate*(t.level===3?1.1:1));
  }
}
function trapEffects(state,dt){
  for(const trap of state.traps){
    if(trap.charges<=0)continue;
    const point={x:trap.col+.5,y:trap.row+.5},info=TRAPS[trap.type];
    for(const e of state.enemies){
      if(!e.alive||ENEMIES[e.type].air||trap.charges<=0||trap.affected.has(e.id))continue;
      if(dist(point,e)>.55)continue;
      trap.affected.add(e.id);trap.charges--;
      if(trap.type==='mine')splash(state,point.x,point.y,info.damage,info.radius,'energy');
      else {e.slowed=Math.max(e.slowed,info.duration);e.slowAmount=Math.max(e.slowAmount,info.slow);}
      state.effects.push({x:point.x,y:point.y,tx:point.x,ty:point.y,life:.3,blast:true});
    }
  }
  state.traps=state.traps.filter(t=>t.charges>0);
}
function moveDrone(state,u,dt){
  const info=UNITS[u.type];
  const d=dist(u,u.to);
  if(d>EPS){const step=Math.min(d,info.speed*dt);u.x+=(u.to.x-u.x)/d*step;u.y+=(u.to.y-u.y)/d*step;}
  u.cooldown=Math.max(-.05,u.cooldown-dt);
  if(u.cooldown>0)return;
  const enemies=state.enemies.filter(e=>e.alive&&!ENEMIES[e.type].air&&dist(u,e)<=info.range)
    .sort((a,b)=>b.progress-a.progress||a.id-b.id);
  if(enemies.length){doAttack(state,u,enemies[0],info.damage,'energy');u.cooldown=1/info.rate;}
}
function stepTeam(state,dt){
  const t=state.team,mode=state.config.objective.type;
  if(!t||t.hp<=0)return;
  const way=state.config.map.researchPath;
  if(mode==='remote'&&t.atDestination)return;
  if(t.working>0){t.working=Math.max(0,t.working-dt);return;}
  if(t.progress>=way.length-1){t.atDestination=true;return;}
  const next=fromCell(way[t.progress+1]);
  const d=dist(t.position,next);
  const step=Math.min(d,(state.config.objective.teamSpeed||.9)*dt);
  if(d>EPS){t.position.x+=(next.x-t.position.x)*step/d;t.position.y+=(next.y-t.position.y)*step/d;}
  if(d<=step+EPS){
    t.position=next;t.progress++;
    if(mode==='escort'&&state.config.objective.stops?.includes(t.progress)&&!t.stopsDone.includes(t.progress)){
      t.stopsDone.push(t.progress);t.working=state.config.objective.stopSeconds;
    }
    if(t.progress>=way.length-1)t.atDestination=true;
  }
}
function moveEnemies(state,dt){
  for(const e of state.enemies){
    if(!e.alive)continue;
    const info=ENEMIES[e.type];
    let team=state.team;
    const chase=team&&!e.chasing&&dist(e,team.position)<2.4;
    if(chase)e.chasing=true;
    const target=e.chasing&&team?team.position:null;
    const step=info.speed*dt*(e.slowed>0?1-e.slowAmount:1);
    if(e.slowed>0){e.slowed=Math.max(0,e.slowed-dt);if(e.slowed===0)e.slowAmount=0;}
    if(target){
      const d=dist(e,target);
      if(d>.65){e.x+=(target.x-e.x)*Math.min(d-.65,step)/d;e.y+=(target.y-e.y)*Math.min(d-.65,step)/d;}
      if(dist(e,target)<=.85){
        const dealt=Math.min(team.hp,info.damage*dt);
        team.hp-=dealt;team.damageTaken+=dealt;
        e.contactTime+=dt;
        if(e.contactTime>=2.5)e.alive=false; // после короткой атаки зверь отступает; награды за прорыв нет
      }
    } else {
      const route=state.config.map.routes[e.route];
      let remains=step;
      while(remains>EPS && e.progress<route.length-1){
        const i=Math.floor(e.progress),fraction=e.progress-i;
        const advance=Math.min(remains,1-fraction);
        e.progress+=advance;remains-=advance;
      }
      const at=Math.min(route.length-1,Math.floor(e.progress)),fraction=e.progress-at;
      const a=route[at],b=route[Math.min(route.length-1,at+1)];
      e.x=a.col+.5+(b.col-a.col)*fraction;
      e.y=a.row+.5+(b.row-a.row)*fraction;
      if(e.progress>=route.length-1-EPS){
        const damage=Math.min(state.targetHp,info.damage*dt);
        state.targetHp-=damage;state.targetDamage+=damage;
        e.contactTime+=dt;
        if(e.contactTime>=2.5)e.alive=false;
      }
    }
    // Nearby enemies may damage a deployed drone, but cannot select it from across the map.
    const near=state.units.filter(u=>u.hp>0&&dist(e,u)<.5);
    for(const unit of near){unit.hp=Math.max(0,unit.hp-info.damage*dt*.55);}
  }
  for(const unit of state.units)if(unit.hp===0&&!unit.countedDeath){unit.countedDeath=true;state.destroyedDrones++;}
}
function objectiveStep(state,dt){
  const obj=state.config.objective;
  if(obj.type==='defend')state.science=Math.min(obj.duration,state.science+dt);
  else if(obj.type==='hold'){
    const unsafe=state.enemies.some(e=>e.alive&&dist(e,state.config.map.target)<=obj.holdRadius);
    if(!unsafe)state.science=Math.min(obj.duration,state.science+dt);
  } else if(obj.type==='remote'){
    if(state.team.atDestination)state.science=Math.min(obj.duration,state.science+dt);
  } else if(obj.type==='escort' && state.team.atDestination){state.science=1;}
}
export function objectiveProgress(state){
  const o=state.config.objective;
  if(o.type==='escort')return Math.min(100,Math.round((state.team.progress+(state.team.atDestination?1:0))/
      state.config.map.researchPath.length*100));
  return Math.min(100,Math.round(state.science/o.duration*100));
}
export function calculateStars(state){
  if(state.phase!=='victory')return 0;
  const obj=state.config.objective;
  const ratio=state.team&&obj.type==='remote'||obj.type==='escort'?
    state.team.hp/state.team.maxHp:state.targetHp/obj.maxHp;
  const second=ratio>=(obj.type==='remote'||obj.type==='escort'?.5:.6)-EPS;
  let third=(obj.type==='remote'||obj.type==='escort')?
    (obj.type==='escort'?state.destroyedDrones===0:state.team.damageTaken<=EPS):state.targetDamage<=EPS;
  return 1+Number(second)+Number(third);
}
export function updateMission(state,dt){
  if(state.phase!=='combat'||!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,.1);
  state.time+=dt;
  state.effects=state.effects.filter(e=>(e.life-=dt)>0);
  if(state.wave){
    state.wave.elapsed+=dt;
    for(const g of state.wave.groups){
      while(g.spawned<g.count&&state.wave.elapsed+EPS>=g.delay+g.spawned*g.interval
          &&state.enemies.length<60){spawn(state,g);g.spawned++;}
    }
  }
  stepTeam(state,dt);
  moveEnemies(state,dt);
  if(state.targetHp<=0 || (state.team&&state.team.hp<=0)){
    state.targetHp=Math.max(0,state.targetHp);
    state.phase='defeat';state.outcomeReason=state.team?.hp<=0?'Исследовательская группа погибла':'Критический прибор уничтожен';
    return;
  }
  trapEffects(state,dt);
  for(const unit of state.units)if(unit.hp>0)moveDrone(state,unit,dt);
  shoot(state,dt);
  state.enemies=state.enemies.filter(e=>e.alive);
  objectiveStep(state,dt);
  if(state.wave&&state.wave.groups.every(g=>g.spawned===g.count)&&state.enemies.length===0){
    state.wave=null;state.supply+=state.config.waveBonus;
    if(state.waveIndex<state.config.waves.length-1)state.phase='intermission';
  }
  const allWavesDone=state.waveIndex===state.config.waves.length-1&&state.wave===null&&state.enemies.length===0;
  const complete=state.config.objective.type==='escort'?state.team.atDestination:
    state.science>=state.config.objective.duration-EPS;
  if(allWavesDone&&complete){state.phase='victory';state.stars=calculateStars(state);}
}
export function inspectAt(state,col,row){
  return state.towers.find(t=>t.col===col&&t.row===row)||
    state.units.find(u=>Math.floor(u.x)===col&&Math.floor(u.y)===row && u.hp>0)||null;
}
export function buildCost(type){const d=TOWERS[type]||TRAPS[type]||UNITS[type];return Array.isArray(d?.cost)?d.cost[0]:d?.cost??0;}
export function countRemainingSpawns(state){
  return state.wave?.groups.reduce((n,g)=>n+g.count-g.spawned,0)??0;
}
