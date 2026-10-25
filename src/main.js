import { BRIEFING, GENERATOR, WAVES, TURRET, RESEARCH } from './config.js';
import {
  createMission, missionProgress, towerAt, validateBuild, placeTower,
  upgradeTower, sellTower, startWave, updateMission, towerRange
} from './model.js';
import {
  loadProgress, storeProgress, markBriefingSeen, markAttempt,
  grantVictory, purchaseResearch, newProgress, SAVE_KEY
} from './progress.js';
import { Battlefield } from './visual.js';

const $=id=>document.getElementById(id);
const allScreens=[...document.querySelectorAll('.screen')];
const loaded=loadProgress();
let progress=loaded.progress, currentScreen='home', mission=null, battlefield=null;
let mode='build', selectedCell=null, selectedTowerId=null;
let briefingIndex=0, briefingAfterPlay=false, briefingReturn='map';
let paused=false, speed=1, lastFrame=0, accumulator=0, resolved=false, attemptCounted=false;
let toastTimer=0;
const STEP=1/60, MAX_STEPS=8;
const touchHint='Тапните по подсвеченной площадке, затем нажмите «Построить».';

function displayScreen(name) {
  currentScreen=name;
  for(const element of allScreens) element.classList.toggle('active',element.id==='screen-'+name);
  window.scrollTo(0,0);
  if(name==='mission') {
    if(!battlefield) battlefield=new Battlefield($('field'),onCellPick);
    battlefield.resize();
    updateHud();
  }
  lastFrame=0;accumulator=0;
}
function save() {
  if(!storeProgress(progress)) {
    $('saveIndicator').textContent='Не удалось сохранить';
    notify('Хранилище браузера недоступно. После закрытия страницы прогресс может пропасть.');
    return;
  }
  $('saveIndicator').textContent='Прогресс сохранён';
}
function notify(text) {
  const element=$('toast');
  element.textContent=text;element.hidden=false;
  window.clearTimeout(toastTimer);
  toastTimer=window.setTimeout(()=>{element.hidden=true;},3600);
}
function updateCamp(){
  $('campMaterials').textContent=progress.resources.materials;
  $('campData').textContent=progress.resources.data;
  $('campStars').textContent=progress.sectors['sector-01'].bestStars+' / 3';
  const hasWon=progress.sectors['sector-01'].victories>0;
  $('campNarrative').textContent=hasWon?
    'Первый защитный купол установлен. Учёные получили новые образцы и ожидают экспедицию в соседние сектора.':
    'Учёные готовят первый энергетический купол. Им требуется защита.';
  const researched=progress.research.precision===true;
  $('researchButton').disabled=researched || !hasWon ||
    progress.resources.materials<RESEARCH.precision.materials;
  $('researchButton').textContent=researched?'✓ Технология изучена':'Изучить — 250 материалов';
  $('researchHint').textContent=researched?'Бонус +10% к урону действует во всех будущих вылазках.':
    !hasWon?'Открывается после первой успешной миссии.':
    progress.resources.materials<250?'Недостаточно материалов. Повторите миссию.':
    'Исследование доступно. Подтвердите покупку.';
}
function updateMap(){
  const record=progress.sectors['sector-01'];
  $('mapStars').textContent='★'.repeat(record.bestStars)+'☆'.repeat(3-record.bestStars);
  $('sector01').title=record.victories>0?'Сектор пройден, можно повторить':'Сектор доступен';
  $('sector02').title=record.victories>0?'Маршрут обнаружен. Сектор появится в MVP.':'Откроется после сектора 01 (будущая версия)';
  $('sector02').querySelector('small').textContent=record.victories>0?'Обнаружен · скоро':'Неизведано';
}
function goCamp(){updateCamp();displayScreen('camp');}
function goMap(){updateMap();displayScreen('map');}
function showBriefing({afterPlay=false,returnTo='map'}={}){
  briefingAfterPlay=afterPlay;briefingReturn=returnTo;briefingIndex=0;
  renderBriefing();displayScreen('briefing');
}
function renderBriefing(){
  const frame=BRIEFING[briefingIndex];
  $('briefTitle').textContent=frame[0];
  $('briefText').textContent=frame[1];
  $('briefStep').textContent='КАДР '+(briefingIndex+1)+' / '+BRIEFING.length;
  $('briefPrevious').disabled=briefingIndex===0;
  $('briefNext').textContent=briefingIndex===BRIEFING.length-1?
    briefingAfterPlay?'К миссии →':'Готово ✓':'Далее →';
  const dots=$('briefDots');dots.replaceChildren();
  BRIEFING.forEach((_,i)=>{
    const dot=document.createElement('span');
    if(i===briefingIndex)dot.classList.add('active');
    dots.append(dot);
  });
}
function finishBriefing(){
  markBriefingSeen(progress);save();
  if(briefingAfterPlay) launchMission();
  else if(briefingReturn==='mission' && mission) displayScreen('mission');
  else if(briefingReturn==='camp') goCamp();
  else goMap();
}
function leaveBriefingWithoutFinishing(){
  if(briefingReturn==='mission' && mission) displayScreen('mission');
  else goMap(); // При первом входе автопросмотр повторится позднее.
}
function playFromMap(){
  if(!progress.sectors['sector-01'].briefingSeen) showBriefing({afterPlay:true,returnTo:'map'});
  else launchMission();
}
function launchMission(){
  mission=createMission({damageBonus:progress.research.precision?0.1:0});
  paused=false;speed=1;accumulator=0;lastFrame=0;
  mode='build';selectedCell=null;selectedTowerId=null;resolved=false;attemptCounted=false;
  $('buildMode').classList.add('active');$('inspectMode').classList.remove('active');
  $('fieldTip').textContent=touchHint;
  displayScreen('mission');
  updateSelection();
  updateHud();
}
function onCellPick(col,row){
  if(!mission || !['preparation','combat','intermission'].includes(mission.phase)) return;
  const tower=towerAt(mission,col,row);
  if(tower) {
    mode='inspect';selectedTowerId=tower.id;selectedCell=null;
  } else if(mode==='build') {
    selectedCell={col,row};selectedTowerId=null;
  } else {
    selectedTowerId=null;selectedCell=null;
  }
  syncModeButtons();updateSelection();
}
function syncModeButtons(){
  $('buildMode').classList.toggle('active',mode==='build');
  $('inspectMode').classList.toggle('active',mode==='inspect');
}
function updateSelection(){
  if(!mission)return;
  const build=$('confirmBuild'),upgrade=$('upgradeButton'),sell=$('sellButton');
  // CSS может переопределить HTML hidden, поэтому видимость задаётся и явно.
  upgrade.hidden=true;sell.hidden=true;upgrade.style.display='none';sell.style.display='none';
  build.hidden=false;build.style.display='inline-flex';
  if(mode==='inspect'){
    build.hidden=true;build.style.display='none';
    const tower=mission.towers.find(t=>t.id===selectedTowerId);
    if(!tower) {
      $('selectionInfo').textContent='Нажмите на установленную башню, чтобы улучшить или продать её.';
      return;
    }
    const cost=TURRET.cost[tower.level]||0;
    const refund=Math.floor(tower.spent*.6);
    $('selectionInfo').textContent='Турель #'+tower.id+' · уровень '+tower.level+'/3 · радиус '+towerRange(tower).toFixed(1)+' клетки.';
    upgrade.hidden=false;sell.hidden=false;upgrade.style.display='inline-flex';sell.style.display='inline-flex';
    upgrade.disabled=tower.level>=3 || cost>mission.supply;
    upgrade.textContent=tower.level>=3?'Максимальный уровень':'Улучшить · '+cost+' ЭС';
    sell.textContent='Продать · +'+refund+' ЭС';
    return;
  }
  if(!selectedCell) {
    $('selectionInfo').textContent='Выберите подсвеченную площадку. Покупка происходит после подтверждения.';
    build.disabled=true;return;
  }
  const check=validateBuild(mission,selectedCell.col,selectedCell.row);
  $('selectionInfo').textContent=check.ok?
    'Площадка ['+(selectedCell.col+1)+', '+(selectedCell.row+1)+'] готова. Радиус стрельбы отмечен на поле.':check.reason;
  build.disabled=!check.ok;
}
function buildTower(){
  if(!mission || !selectedCell || mode!=='build')return;
  const r=placeTower(mission,selectedCell.col,selectedCell.row);
  if(!r.ok){notify(r.reason);updateSelection();return;}
  selectedCell=null;
  $('fieldTip').textContent='Турель установлена. Постройте ещё одну или запускайте волну.';
  updateSelection();updateHud();
}
function upgradeSelected(){
  if(!mission || selectedTowerId===null)return;
  const r=upgradeTower(mission,selectedTowerId);
  if(!r.ok)notify(r.reason);
  updateSelection();updateHud();
}
function sellSelected(){
  if(!mission || selectedTowerId===null)return;
  const r=sellTower(mission,selectedTowerId);
  if(!r.ok)notify(r.reason);
  else {notify('Вернулось '+r.refund+' ЭС');selectedTowerId=null;}
  updateSelection();updateHud();
}
function beginWave(){
  if(!mission)return;
  const r=startWave(mission);
  if(!r.ok){notify(r.reason);return;}
  if(!attemptCounted) {markAttempt(progress);attemptCounted=true;save();}
  $('fieldTip').textContent='Волна '+r.number+' идёт. Турели атакуют автоматически.';
  updateHud();
}
function updateHud(){
  if(!mission)return;
  const phase=mission.phase;
  const phaseNames={preparation:'ПОДГОТОВКА',intermission:'МЕЖДУ ВОЛНАМИ',combat:'ИДЁТ БОЙ',victory:'ПОБЕДА',defeat:'ПОРАЖЕНИЕ'};
  $('gamePhase').textContent=paused?'ПАУЗА':phaseNames[phase];
  $('hudHp').textContent=Math.ceil(mission.targetHp)+' / '+GENERATOR.maxHp;
  $('hpBar').style.width=(100*mission.targetHp/GENERATOR.maxHp)+'%';
  $('hudInstall').textContent=missionProgress(mission)+'%';
  $('installBar').style.width=missionProgress(mission)+'%';
  $('hudWave').textContent=Math.max(0,mission.waveIndex+1)+' / '+WAVES.length;
  $('hudSupply').textContent=Math.floor(mission.supply)+' ЭС';
  $('hudKills').textContent=mission.kills;
  $('pauseButton').textContent=paused?'▶ Продолжить':'⏸ Пауза';
  $('speedButton').textContent='Скорость '+speed+'×';
  const canStart=phase==='preparation'||phase==='intermission';
  $('startWave').disabled=!canStart;
  $('startWave').textContent=canStart?'Запустить волну '+(mission.waveIndex+2)+' →':
    mission.waveIndex===WAVES.length-1?'Все волны запущены':'Волна в процессе';
  if(canStart){
    const info=WAVES[mission.waveIndex+1];
    $('nextWaveInfo').textContent='Волна '+(mission.waveIndex+2)+': '+info.count+' Искрошмыгов, западный подход. Интервал '+info.interval+' сек.';
  }else{
    $('nextWaveInfo').textContent=mission.waveIndex===WAVES.length-1 && mission.wave===null?
      'Все противники побеждены. Дождитесь завершения монтажа.':
      'Защищайте генератор, пока идёт атака.';
  }
  updateSelection();
}
function settleMission() {
  if(!mission || resolved || !['victory','defeat'].includes(mission.phase))return;
  resolved=true;
  const win=mission.phase==='victory';
  let prize=null;
  if(win){prize=grantVictory(progress,mission.stars);save();}
  const record=progress.sectors['sector-01'];
  $('resultsBadge').textContent=win?'ОПЕРАЦИЯ ЗАВЕРШЕНА':'ОПЕРАЦИЯ ПРЕРВАНА';
  $('resultsTitle').textContent=win?'Купол установлен':'Генератор потерян';
  $('resultsStars').textContent=win?'★'.repeat(mission.stars)+'☆'.repeat(3-mission.stars):'☆☆☆';
  $('resultDescription').textContent=win?
    'Исследователи завершили монтаж, оборона удержала линию. Лучший результат: '+record.bestStars+' из 3 звёзд.':
    'Экспедиция отступила: '+mission.outcomeReason+'. Вы можете попробовать снова без потери постоянных ресурсов.';
  const stats=[
    ['Состояние генератора',Math.ceil(mission.targetHp)+' / '+GENERATOR.maxHp],
    ['Повержено существ',String(mission.kills)],
    ['Состояние монтажа',missionProgress(mission)+'%']
  ];
  const root=$('resultStats');root.replaceChildren();
  stats.forEach(([label,value])=>{
    const box=document.createElement('div'),l=document.createElement('span'),v=document.createElement('strong');
    l.textContent=label;v.textContent=value;box.append(l,v);root.append(box);
  });
  const reward=$('rewardBox');reward.replaceChildren();
  reward.classList.toggle('empty',!win);
  const a=document.createElement('strong'),b=document.createElement('small');
  a.textContent=win?'+'+prize.materials+' материалов · +'+prize.data+' данных':'Награда за эту попытку: 0';
  b.textContent=win?(prize.first?'Включена разовая премия за первую победу.':'Повторное прохождение — обычная награда.'):'Дополнительные звёзды и ресурсы даются только за победу.';
  reward.append(a,b);
  displayScreen('results');
}
function tick(now){
  requestAnimationFrame(tick);
  if(currentScreen!=='mission' || !mission){lastFrame=now;return;}
  if(!lastFrame)lastFrame=now;
  const elapsed=Math.min(Math.max(0,now-lastFrame)/1000,.25);
  lastFrame=now;
  if(!paused && mission.phase==='combat'){
    accumulator+=elapsed*speed;
    let count=0;
    while(accumulator>=STEP && count<MAX_STEPS && mission.phase==='combat'){
      updateMission(mission,STEP);accumulator-=STEP;count++;
    }
    if(count===MAX_STEPS)accumulator=0;
  }
  battlefield.render(mission,{selectedCell,selectedTowerId,mode,paused});
  if(mission.phase==='victory'||mission.phase==='defeat')settleMission();
  else updateHud();
}
function bind(id,handler){$(id).addEventListener('click',handler);}
bind('continueButton',goCamp);
bind('homeShortcut',()=>{
  if(currentScreen==='mission')$('quitDialog').showModal();
  else displayScreen('home');
});
bind('homeHelp',()=>$('helpDialog').showModal());
bind('toMap',goMap);bind('mapBack',goCamp);bind('sector01',()=>notify('Выбран сектор 01. Нажмите «Начать миссию» справа.'));
bind('mapPlay',playFromMap);
bind('mapBrief',()=>showBriefing({afterPlay:false,returnTo:'map'}));
bind('briefPrevious',()=>{briefingIndex=Math.max(0,briefingIndex-1);renderBriefing();});
bind('briefNext',()=>{if(briefingIndex>=BRIEFING.length-1)finishBriefing();else{briefingIndex++;renderBriefing();}});
bind('briefSkip',finishBriefing);
bind('briefClose',leaveBriefingWithoutFinishing);
bind('researchButton',()=>{
  const result=purchaseResearch(progress,'precision');
  if(result.ok){save();notify('Точный привод I изучен. Турели наносят +10% урона.');updateCamp();}
  else notify(result.reason);
});
bind('buildMode',()=>{mode='build';selectedTowerId=null;syncModeButtons();updateSelection();});
bind('inspectMode',()=>{mode='inspect';selectedCell=null;syncModeButtons();updateSelection();});
bind('confirmBuild',buildTower);bind('upgradeButton',upgradeSelected);bind('sellButton',sellSelected);
bind('startWave',beginWave);
bind('pauseButton',()=>{if(!mission)return;paused=!paused;accumulator=0;updateHud();});
bind('speedButton',()=>{speed=speed===1?2:1;accumulator=0;updateHud();});
bind('zoomOut',()=>battlefield?.changeZoom(1/1.2));
bind('zoomIn',()=>battlefield?.changeZoom(1.2));
bind('missionBrief',()=>showBriefing({afterPlay:false,returnTo:'mission'}));
bind('quitMission',()=>$('quitDialog').showModal());
bind('quitCancel',()=>$('quitDialog').close());
bind('quitConfirm',()=>{$('quitDialog').close();mission=null;goCamp();});
bind('resultsCamp',()=>{mission=null;goCamp();});
bind('resultsRetry',launchMission);
document.addEventListener('keydown',event=>{
  if(currentScreen!=='mission' || event.target.closest('button,input,textarea,dialog'))return;
  if(event.code==='Space'){event.preventDefault();paused=!paused;updateHud();}
  else if(event.key==='Escape'){selectedCell=null;selectedTowerId=null;updateSelection();}
  else if(event.key==='+'||event.key==='=')battlefield?.changeZoom(1.2);
  else if(event.key==='-')battlefield?.changeZoom(1/1.2);
  else if(battlefield && event.key.toLowerCase() in {w:1,a:1,s:1,d:1}){
    const move=.75;
    if(event.key.toLowerCase()==='w')battlefield.camY-=move;
    if(event.key.toLowerCase()==='s')battlefield.camY+=move;
    if(event.key.toLowerCase()==='a')battlefield.camX-=move;
    if(event.key.toLowerCase()==='d')battlefield.camX+=move;
    battlefield.clampCamera();
  }
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden && currentScreen==='mission' && mission) {paused=true;accumulator=0;}
  lastFrame=0;
});
window.addEventListener('blur',()=>{if(currentScreen==='mission'&&mission){paused=true;accumulator=0;}});
if(loaded.warning)window.setTimeout(()=>notify(loaded.warning),500);
if(progress.sectors['sector-01'].victories>0)$('continueButton').textContent='Продолжить экспедицию';
requestAnimationFrame(tick);
