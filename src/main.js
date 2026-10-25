import { MISSIONS, MISSION_IDS, ENEMIES, TOWERS, TRAPS, UNITS, RESEARCH, sectorId } from './config.js';
import {
  createMission, canBuild, build, upgrade, sell, startWave, commandDrone, inspectAt,
  towerRange, updateMission, objectiveProgress, buildCost
} from './model.js';
import {
  loadProgress, storeProgress, newProgress, markAttempt, markBriefingSeen,
  grantVictory, purchaseResearch, researchAvailable, campaignComplete
} from './progress.js';
import { Battlefield } from './visual.js';
import { AudioDirector } from './audio.js';

const $=id=>document.getElementById(id);
const screens=[...document.querySelectorAll('.screen')];
let {progress,warning:loadWarning}=loadProgress();
const audio=new AudioDirector(()=>progress.settings);
let settingsReturn='camp';
document.documentElement.classList.toggle('reduced-motion',progress.settings.reducedMotion);
let screen='home', selectedMission='sector-01', mission=null, field=null;
let briefIndex=0,briefReturn='map',briefToPlay=false;
let selectedType='kinetic',selectedCell=null,selectedId=null,mode='build',moveCommand=false;
let paused=false,speed=1,resolved=false,attemptCounted=false,accumulator=0,lastFrame=0,lastHud=0;
const STEP=1/60,MAX_STEPS=8;
let toastTimeout;
const activeSector=()=>MISSIONS[selectedMission];
const record=id=>progress.sectors[id];
const maxStars=()=>MISSION_IDS.reduce((sum,id)=>sum+record(id).bestStars,0);
const isUnlocked=id=>progress.unlockedSectorIds.includes(id);
const formatRewards=r=>(r.materials+r.firstMaterials)+' материалов · '+(r.data+r.firstData)+' данных';
const $text=(id,value)=>{$(id).textContent=String(value);};
const element=(tag,cls='',text='')=>{
  const x=document.createElement(tag);
  if(cls)x.className=cls;
  if(text!==undefined)x.textContent=text;
  return x;
};
function toast(value){
  const x=$('toast');x.textContent=value;x.hidden=false;
  clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{x.hidden=true;},3800);
}
function save(){
  if(storeProgress(progress))$text('saveIndicator','Прогресс сохранён');
  else{$text('saveIndicator','Ошибка сохранения');toast('Данные браузера недоступны. Прогресс может быть потерян после закрытия страницы.');}
}
function show(name){
  screen=name;
  screens.forEach(el=>el.classList.toggle('active',el.id==='screen-'+name));
  window.scrollTo(0,0);lastFrame=0;accumulator=0;
  if(name==='mission'&&mission){
    if(!field)field=new Battlefield($('field'),pickOnMap);
    field.resize();
    hud();
  }
}
function camp(){
  $text('campMaterials',progress.resources.materials);
  $text('campData',progress.resources.data);
  $text('campStars',maxStars()+' / 18');
  const count=MISSION_IDS.filter(id=>record(id).victories>0).length;
  $text('campNarrative',campaignComplete(progress)?
    'Все шесть районов первой главы исследованы. Оборонные узлы развёрнуты, а учёные возвращаются с новыми открытиями.':
    count?'Исследовано секторов: '+count+' / 6. Инженеры внедряют новые устройства после каждой успешной экспедиции.':
    'Учёные готовят первый энергетический купол. Им требуется защита.');
  const root=$('researchList');root.replaceChildren();
  for(const [id,r] of Object.entries(RESEARCH)){
    const article=element('div','research-info');
    const icon=element('div','tech-icon','⌁');
    const body=element('div','tech-content');
    body.append(element('strong','',r.name),element('p','',r.desc),
      element('small','',r.materials+' материалов · '+r.data+' данных'));
    const button=element('button','btn outline block',progress.research[id]?'✓ Изучено':'Исследовать');
    button.type='button';const availability=researchAvailable(progress,id);button.disabled=!availability.ok;
    button.addEventListener('click',()=>{
      const result=purchaseResearch(progress,id);
      if(result.ok){save();audio.cue('research');toast('Технология «'+r.name+'» изучена.');camp();}
      else toast(result.reason);
    });
    body.append(button);
    if(!availability.ok&&!progress.research[id])body.append(element('small','blocked-research',availability.reason));
    article.append(icon,body);root.append(article);
  }
  $text('researchHint','Технологии открываются по мере прохождения секторов. ПВО перед сектором 05 разблокируется автоматически.');
  show('camp');
}
function archive(){
  const sectorRoot=$('archiveSectors'),enemyRoot=$('archiveEnemies');
  sectorRoot.replaceChildren();enemyRoot.replaceChildren();
  for(const id of MISSION_IDS){
    const def=MISSIONS[id],rec=record(id),unlocked=isUnlocked(id);
    const item=element('div','archive-entry');
    const head=element('div','archive-head');
    head.append(element('strong','',String(def.number).padStart(2,'0')+' · '+(unlocked?def.name:'Неизвестный сектор')),
      element('small','',unlocked?'★'.repeat(rec.bestStars)+'☆'.repeat(3-rec.bestStars):'🔒'));
    item.append(head);
    if(unlocked){
      item.append(element('p','',def.summary));
      const b=element('button','btn outline','Повторить брифинг');
      b.type='button';
      b.addEventListener('click',()=>{
        if(mission)return toast('Откройте архивный брифинг после завершения текущей вылазки.');
        selectedMission=id;briefing({returnTo:'archive'});
      });
      item.append(b);
    }else item.append(element('p','','Информация станет доступна после исследования предыдущего сектора.'));
    sectorRoot.append(item);
  }
  const encountered=new Set();
  for(const id of MISSION_IDS){
    if(record(id).attempts>0 || record(id).victories>0){
      for(const wave of MISSIONS[id].waves)for(const group of wave.groups)encountered.add(group.type);
    }
  }
  for(const [id,def] of Object.entries(ENEMIES)){
    const discovered=encountered.has(id);
    const item=element('div','archive-entry');
    item.append(element('strong','',discovered?def.name:'Неизвестный вид'));
    item.append(element('p','',discovered?
      'Здоровье: '+def.hp+' · скорость: '+def.speed+' кл/с · '+(def.air?'летающий':'наземный')+
      (def.kinetic?' · кинетическая броня '+Math.round(def.kinetic*100)+'%':'')+
      ' · награда за уничтожение: '+def.reward+' ЭС.':'Встретьте существо во время экспедиции, чтобы открыть сведения.'));
    enemyRoot.append(item);
  }
  show('archive');
}
function settings(){
  $text('musicValue',Math.round(progress.settings.musicVolume*100)+'%');
  $text('sfxValue',Math.round(progress.settings.sfxVolume*100)+'%');
  $('musicVolume').value=Math.round(progress.settings.musicVolume*100);
  $('sfxVolume').value=Math.round(progress.settings.sfxVolume*100);
  $('reducedMotion').checked=progress.settings.reducedMotion;
  show('settings');
}
function map(){
  const root=$('sectorNodes');root.replaceChildren();
  for(const id of MISSION_IDS){
    const def=MISSIONS[id],rec=record(id),unlocked=isUnlocked(id);
    const button=element('button','sector-chip '+(unlocked?'available':'locked')+(id===selectedMission?' selected':''));
    button.type='button';button.disabled=false;button.setAttribute('aria-pressed',String(id===selectedMission));
    button.append(element('span','sector-index',String(def.number).padStart(2,'0')),
      element('strong','',unlocked?def.name:'Неизведано'),
      element('small','',unlocked?'★'.repeat(rec.bestStars)+'☆'.repeat(3-rec.bestStars):'🔒 Сектор закрыт'));
    button.addEventListener('click',()=>{selectedMission=id;map();});
    root.append(button);
  }
  const def=activeSector(),rec=record(selectedMission),available=isUnlocked(selectedMission);
  $text('mapBiome',def.biome.toUpperCase()+' // СЕКТОР '+String(def.number).padStart(2,'0'));
  $text('mapTitle',def.name);$text('mapStars','★'.repeat(rec.bestStars)+'☆'.repeat(3-rec.bestStars));
  $text('mapSummary',def.summary);
  const objectives={defend:'Защитить прибор и завершить монтаж',hold:'Удержать пункт наблюдения до завершения исследования',remote:'Доставить научную группу и защитить монтаж',escort:'Сопроводить группу до эвакуации'};
  $text('mapObjective',objectives[def.objective.type]);
  const threats=[...new Set(def.waves.flatMap(w=>w.groups.map(g=>ENEMIES[g.type].name)))];
  $text('mapThreat',threats.join(' · ')+' · '+def.waves.length+' волн');
  $text('mapConditions',def.stars.join(' / '));$text('mapRewards',formatRewards(def.rewards));
  $('mapPlay').disabled=!available;
  $('mapBrief').disabled=!available;
  $text('mapPlay',available?(rec.victories?'Повторить миссию':'Начать миссию'):'Сектор ещё закрыт');
  $text('mapNotice',available?(rec.victories?'Сектор пройден, допускаются неограниченные повторы.':'Сектор доступен для первой вылазки.'):'Завершите предыдущий сектор, чтобы открыть эту область.');
  show('map');
}
function briefing({toPlay=false,returnTo='map'}={}){
  briefToPlay=toPlay;briefReturn=returnTo;briefIndex=0;drawBrief();show('briefing');
}
function drawBrief(){
  const def=activeSector(),frame=def.briefing[briefIndex];
  $text('briefSector','ПОЛЁТНОЕ ЗАДАНИЕ · СЕКТОР '+String(def.number).padStart(2,'0'));
  $text('briefStep','КАДР '+(briefIndex+1)+' / '+def.briefing.length);
  $text('briefTitle',frame[0]);$text('briefText',frame[1]);
  $('briefPrevious').disabled=briefIndex===0;
  $text('briefNext',briefIndex===def.briefing.length-1?(briefToPlay?'К миссии →':'Завершить ✓'):'Далее →');
  const dots=$('briefDots');dots.replaceChildren();
  def.briefing.forEach((_,i)=>dots.append(element('span',i===briefIndex?'active':'')));
}
function briefingDone(){
  markBriefingSeen(progress,selectedMission);save();
  if(briefToPlay)launch(selectedMission);
  else if(briefReturn==='mission'&&mission)show('mission');
  else if(briefReturn==='archive')archive();
  else map();
}
function briefingClosed(){if(briefReturn==='mission'&&mission)show('mission');else if(briefReturn==='archive')archive();else map();}
function play(){
  if(!isUnlocked(selectedMission))return toast('Этот сектор ещё закрыт');
  if(!record(selectedMission).briefingSeen)briefing({toPlay:true});
  else launch(selectedMission);
}
function launch(id){
  selectedMission=id;mission=createMission(id,progress.research);
  resolved=false;attemptCounted=false;paused=false;speed=1;lastFrame=0;lastHud=0;accumulator=0;
  mode='build';moveCommand=false;selectedCell=null;selectedId=null;
  selectedType=mission.config.allowed.towers[0];
  const def=activeSector();
  $text('missionSector','СЕКТОР '+String(def.number).padStart(2,'0')+' · '+def.biome.toUpperCase());
  $text('missionTitle',def.name);
  $text('fieldLocation','N7 / '+String(def.number).padStart(2,'0')+' — ТАКТИЧЕСКАЯ КАРТА');
  const objectives=$('objectives');objectives.replaceChildren();
  def.stars.forEach(s=>objectives.append(element('span','', '★ '+s)));
  if(!field)field=new Battlefield($('field'),pickOnMap);
  show('mission');field.setMission(mission);
  $text('fieldTip','Подготовьте оборону. Выберите устройство, затем подтвердите размещение.');
  renderEquipment();selection();hud();
}
function renderEquipment(){
  const root=$('equipmentList');root.replaceChildren();
  const def=mission.config.allowed;
  const modes=[...def.towers,...def.traps,...def.units];
  for(const type of modes){
    const data=TOWERS[type]||TRAPS[type]||UNITS[type];
    const button=element('button','build-option'+(selectedType===type&&mode==='build'?' active':''));
    button.type='button';button.append(element('span','build-icon',data.icon));
    const label=element('span','build-name');label.append(element('strong','',data.short||data.name),element('small','',buildCost(type)+' ЭС · '+(TOWERS[type]?'Башня':TRAPS[type]?'Ловушка':'Подвижный отряд')));
    button.append(label);
    button.addEventListener('click',()=>{mode='build';moveCommand=false;selectedType=type;selectedId=null;selectedCell=null;renderEquipment();selection();});
    root.append(button);
  }
  const inspect=element('button','build-option'+(mode==='inspect'?' active':''));
  inspect.type='button';inspect.append(element('span','build-icon','◎'));
  const inner=element('span');inner.append(element('strong','','Осмотр / команды'),element('small','','Улучшение и перемещение'));
  inspect.append(inner);
  inspect.addEventListener('click',()=>{mode='inspect';selectedCell=null;selectedId=null;moveCommand=false;renderEquipment();selection();});
  root.append(inspect);
}
function pickOnMap(col,row,pos){
  if(!mission||!['preparation','combat','intermission'].includes(mission.phase))return;
  if(moveCommand&&selectedId!==null){
    const result=commandDrone(mission,selectedId,pos.x,pos.y);
    if(!result.ok)toast(result.reason);else toast('Дрон направлен к новой позиции.');
    moveCommand=false;selection();return;
  }
  const item=inspectAt(mission,col,row);
  if(item){
    selectedId=item.id;selectedCell=null;mode='inspect';
    renderEquipment();selection();return;
  }
  if(mode==='build'){selectedCell={col,row};selectedId=null;}
  else{selectedId=null;selectedCell=null;}
  selection();
}
function selection(){
  if(!mission)return;
  const info=$('selectionInfo'),confirm=$('confirmBuild'),upgradeButton=$('upgradeButton'),
    sellButton=$('sellButton'),commandButton=$('commandButton');
  for(const b of [confirm,upgradeButton,sellButton,commandButton])b.hidden=true;
  if(mode==='inspect'){
    const t=mission.towers.find(o=>o.id===selectedId);
    const u=mission.units.find(o=>o.id===selectedId&&o.hp>0);
    if(t){
      const spec=TOWERS[t.type],price=spec.cost[t.level],refund=Math.floor(t.spent*.6);
      info.textContent=spec.name+' · уровень '+t.level+'/3 · радиус '+towerRange(t).toFixed(1);
      upgradeButton.hidden=false;upgradeButton.disabled=t.level===3||mission.supply<price;
      upgradeButton.textContent=t.level===3?'Максимальный уровень':'Улучшить · '+price+' ЭС';
      sellButton.hidden=false;sellButton.textContent='Продать · +'+refund+' ЭС';
    } else if(u){
      info.textContent=moveCommand?'Теперь выберите точку назначения дрона на карте.':
        'Разведдрон: HP '+Math.ceil(u.hp)+' / '+u.maxHp+'. Атакует наземных врагов.';
      commandButton.hidden=false;commandButton.textContent=moveCommand?'Отменить перемещение':'Переместить дрон';
    }else info.textContent='Нажмите на установленную башню или дрон, чтобы открыть команды.';
    return;
  }
  confirm.hidden=false;confirm.textContent='Построить · '+buildCost(selectedType)+' ЭС';
  if(!selectedCell){info.textContent='Выберите '+(TRAPS[selectedType]?'янтарную метку на тропе':UNITS[selectedType]?'любую клетку для дрона':'светящуюся строительную площадку')+'.';confirm.disabled=true;return;}
  const check=canBuild(mission,selectedType,selectedCell.col,selectedCell.row);
  info.textContent=check.ok?'Выбрана клетка '+(selectedCell.col+1)+' × '+(selectedCell.row+1)+'. Нажмите «Построить».':check.reason;
  confirm.disabled=!check.ok;
}
function buildSelected(){
  if(!mission||!selectedCell||mode!=='build')return;
  const result=build(mission,selectedType,selectedCell.col,selectedCell.row);
  if(!result.ok){toast(result.reason);selection();return;}
  audio.cue('build');selectedCell=null;selection();hud();
}
function upgradeSelected(){
  const result=upgrade(mission,selectedId);if(!result.ok)toast(result.reason);else audio.cue('build');
  selection();hud();
}
function sellSelected(){
  const result=sell(mission,selectedId);
  if(result.ok){selectedId=null;audio.cue('select');toast('Возвращено '+result.refund+' ЭС.');}
  else toast(result.reason);
  selection();hud();
}
function nextWave(){
  const result=startWave(mission);
  if(!result.ok){toast(result.reason);return;}
  audio.cue('wave');
  if(!attemptCounted){markAttempt(progress,selectedMission);save();attemptCounted=true;}
  $text('fieldTip','Волна '+(mission.waveIndex+1)+' началась. Следите за приборами и мобильной группой.');
  hud();
}
function hud(){
  if(!mission)return;
  const def=mission.config,phase=mission.phase;
  const primary=mission.team?mission.team.hp:mission.targetHp;
  const primaryMax=mission.team?mission.team.maxHp:def.objective.maxHp;
  $text('hudTargetLabel',mission.team?'Группа · прибор '+Math.ceil(mission.targetHp)+' HP':'Критический прибор');
  $text('hudHp',Math.ceil(primary)+' / '+primaryMax);$('hpBar').style.width=(primary/primaryMax*100)+'%';
  const stage=def.objective.type==='escort'?'Путь к эвакуации':
    def.objective.type==='remote'&&mission.team&&!mission.team.atDestination?'Доставка оборудования':
    def.objective.type==='hold'?'Безопасное сканирование':'Монтаж / исследование';
  $text('hudScienceLabel',stage);
  $text('hudInstall',objectiveProgress(mission)+'%');$('installBar').style.width=objectiveProgress(mission)+'%';
  $text('hudWave',Math.max(0,mission.waveIndex+1)+' / '+def.waves.length);
  $text('hudSupply',Math.floor(mission.supply)+' ЭС');$text('hudKills',mission.kills);
  const names={preparation:'ПОДГОТОВКА',combat:'ИДЁТ БОЙ',intermission:'МЕЖДУ ВОЛНАМИ'};
  $text('gamePhase',paused?'ПАУЗА':names[phase]||phase.toUpperCase());
  $text('pauseButton',paused?'▶ Продолжить':'⏸ Пауза');$text('speedButton','Скорость '+speed+'×');
  const ready=['preparation','intermission'].includes(phase);
  $('startWave').disabled=!ready;
  $text('startWave',ready?'Запустить волну '+(mission.waveIndex+2)+' →':'Волна в процессе');
  if(ready){
    const groups=def.waves[mission.waveIndex+1]?.groups||[];
    $text('nextWaveInfo',groups.map(g=>g.count+' × '+ENEMIES[g.type].name+(g.route==='air'?' (воздух)':g.route==='north'?' (север)':'')).join(' · '));
  }else{
    $text('nextWaveInfo',mission.wave===null?'Ожидайте выполнения научной задачи.':
      'Волна в бою. Обороняйте приоритетные объекты.');
  }
  selection();
}
function finishMission(){
  if(resolved||!mission||!['victory','defeat'].includes(mission.phase))return;
  resolved=true;
  const success=mission.phase==='victory',def=mission.config;
  const prize=success?grantVictory(progress,selectedMission,mission.stars):null;
  if(success)save();
  audio.cue(success?'victory':'defeat');
  $text('resultsSector','ОТЧЁТ // СЕКТОР '+String(def.number).padStart(2,'0'));
  $text('resultsBadge',success?(campaignComplete(progress)?'ПЕРВАЯ ГЛАВА ЗАВЕРШЕНА':'МИССИЯ ВЫПОЛНЕНА'):'ЭКСПЕДИЦИЯ ОТСТУПИЛА');
  $text('resultsTitle',success?(campaignComplete(progress)?'Карта исследована':def.name+' — успех'):'Задание провалено');
  $text('resultsStars',success?'★'.repeat(mission.stars)+'☆'.repeat(3-mission.stars):'☆☆☆');
  $text('resultDescription',success?
    'Лучший результат: '+record(selectedMission).bestStars+'/3 звёзд. '+(campaignComplete(progress)?
    'Все шесть секторов первой главы доступны для повторного прохождения.':'Следующий сектор открыт на карте.'):
    mission.outcomeReason+'. Попробуйте изменить построение обороны.');
  const root=$('resultStats');root.replaceChildren();
  const stats=[['Прибор',Math.ceil(mission.targetHp)+' / '+def.objective.maxHp],
    [mission.team?'HP группы':'Уничтожено',mission.team?Math.ceil(mission.team.hp)+' / '+mission.team.maxHp:mission.kills],
    ['Прогресс',objectiveProgress(mission)+'%']];
  for(const [label,value] of stats){
    const cell=element('div');cell.append(element('span','',label),element('strong','',String(value)));root.append(cell);
  }
  const reward=$('rewardBox');reward.replaceChildren();reward.classList.toggle('empty',!success);
  reward.append(element('strong','',success?'+'+prize.materials+' материалов · +'+prize.data+' данных':'Награда: 0'),
    element('small','',success?prize.first?'Включена разовая премия за первую победу.':'Повторная победа — только обычная награда.':
      'Постоянные ресурсы при поражении не теряются.'));
  show('results');
}
function tick(now){
  requestAnimationFrame(tick);
  if(screen!=='mission'||!mission){lastFrame=now;return;}
  if(!lastFrame)lastFrame=now;
  const elapsed=Math.min(.25,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
  if(!paused&&mission.phase==='combat'){
    accumulator+=elapsed*speed;
    let n=0;
    while(accumulator>=STEP&&n<MAX_STEPS&&mission.phase==='combat'){
      updateMission(mission,STEP);accumulator-=STEP;n++;
    }
    if(n===MAX_STEPS)accumulator=0;
  }
  field.render(mission,{selectedCell,selectedId,selectedType,mode,paused});
  if(['victory','defeat'].includes(mission.phase))finishMission();
  else if(now-lastHud>100){lastHud=now;hud();}
}
const on=(id,fn)=>$(id).addEventListener('click',fn);
on('archiveShortcut',()=>{
  if(mission)return toast('Архив доступен после завершения вылазки.');
  archive();
});
on('settingsShortcut',()=>{
  settingsReturn=screen;
  settings();
});
on('archiveBack',camp);
on('settingsBack',()=>{
  if(settingsReturn==='mission'&&mission)show('mission');
  else if(settingsReturn==='briefing')show('briefing');
  else if(settingsReturn==='map')map();
  else if(settingsReturn==='archive')archive();
  else if(settingsReturn==='home')show('home');
  else camp();
});
$('musicVolume').addEventListener('input',e=>{
  progress.settings.musicVolume=Number(e.target.value)/100;
  $text('musicValue',e.target.value+'%');
  audio.startMusic();save();
});
$('sfxVolume').addEventListener('input',e=>{
  progress.settings.sfxVolume=Number(e.target.value)/100;
  $text('sfxValue',e.target.value+'%');save();
});
$('reducedMotion').addEventListener('change',e=>{
  progress.settings.reducedMotion=e.target.checked;
  document.documentElement.classList.toggle('reduced-motion',e.target.checked);
  save();
});
on('testSound',()=>audio.cue('test'));
on('continueButton',camp);
on('homeShortcut',()=>mission&&['preparation','combat','intermission'].includes(mission.phase)?$('quitDialog').showModal():show('home'));
on('homeHelp',()=>$('helpDialog').showModal());
on('newGameButton',()=>{
  if(!window.confirm('Начать заново? Все звёзды, технологии и ресурсы будут удалены.'))return;
  progress=newProgress();mission=null;selectedMission='sector-01';save();toast('Создана новая экспедиция.');camp();
});
on('toMap',map);on('mapBack',camp);on('mapPlay',play);
on('mapBrief',()=>{if(isUnlocked(selectedMission))briefing();});
on('briefPrevious',()=>{briefIndex=Math.max(0,briefIndex-1);drawBrief();});
on('briefNext',()=>{if(briefIndex>=activeSector().briefing.length-1)briefingDone();else{briefIndex++;drawBrief();}});
on('briefSkip',briefingDone);on('briefClose',briefingClosed);
on('missionBrief',()=>briefing({returnTo:'mission'}));
on('quitMission',()=>$('quitDialog').showModal());
on('quitCancel',()=>$('quitDialog').close());
on('quitConfirm',()=>{$('quitDialog').close();mission=null;camp();});
on('confirmBuild',buildSelected);on('upgradeButton',upgradeSelected);on('sellButton',sellSelected);
on('commandButton',()=>{moveCommand=!moveCommand;selection();});
on('startWave',nextWave);
on('pauseButton',()=>{paused=!paused;accumulator=0;hud();});
on('speedButton',()=>{speed=speed===1?2:1;accumulator=0;hud();});
on('zoomOut',()=>field?.changeZoom(1/1.2));on('zoomIn',()=>field?.changeZoom(1.2));
on('resultsCamp',()=>{mission=null;camp();});
on('resultsRetry',()=>launch(selectedMission));
document.addEventListener('keydown',event=>{
  if(screen!=='mission'||!mission||event.target.closest('button,input,textarea,dialog'))return;
  const k=event.key.toLowerCase();
  if(event.code==='Space'){event.preventDefault();paused=!paused;accumulator=0;hud();}
  else if(event.key==='Escape'){moveCommand=false;selectedId=null;selectedCell=null;selection();}
  else if(k==='+'||k==='=')field?.changeZoom(1.2);
  else if(k==='-')field?.changeZoom(1/1.2);
  else if(['w','a','s','d'].includes(k)&&field){
    if(k==='w')field.camY-=.8;if(k==='s')field.camY+=.8;
    if(k==='a')field.camX-=.8;if(k==='d')field.camX+=.8;
    field.clampCamera();
  }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='mission'&&mission){paused=true;accumulator=0;}lastFrame=0;});
window.addEventListener('blur',()=>{if(screen==='mission'&&mission){paused=true;accumulator=0;}});
if(loadWarning)setTimeout(()=>toast(loadWarning),500);
if(MISSION_IDS.some(id=>record(id).victories>0))$text('continueButton','Продолжить экспедицию');
document.addEventListener('pointerdown',()=>audio.startMusic(),{once:true});
document.addEventListener('keydown',()=>audio.startMusic(),{once:true});
requestAnimationFrame(tick);
