import { MISSION_IDS, MISSIONS, RESEARCH, preceding } from './config.js';

// Retain existing key so players of the first vertical slice keep their progress.
export const SAVE_KEY='towerdefence-nova7-v1';
const safeInt=(v)=>Number.isSafeInteger(v)&&v>=0?Math.min(v,100000000):0;
const record=()=>({briefingSeen:false,firstVictoryClaimed:false,bestStars:0,victories:0,attempts:0});
export function newProgress(){
  return {
    schemaVersion:3,campaignId:'nova7-complete',
    sectors:Object.fromEntries(MISSION_IDS.map(id=>[id,record()])),
    unlockedSectorIds:['sector-01'],
    resources:{materials:0,data:0},
    research:{},settings:{musicVolume:0,sfxVolume:.7,reducedMotion:false}
  };
}
export function sanitizeProgress(input){
  const p=newProgress();
  if(!input||typeof input!=='object'||![1,2,3].includes(input.schemaVersion))return p;
  for(const id of MISSION_IDS){
    const old=input.sectors?.[id]||{};
    const wins=safeInt(old.victories);
    p.sectors[id]={
      briefingSeen:old.briefingSeen===true,firstVictoryClaimed:old.firstVictoryClaimed===true||wins>0,
      bestStars:Math.min(3,safeInt(old.bestStars)),victories:wins,attempts:safeInt(old.attempts)
    };
  }
  p.resources={materials:safeInt(input.resources?.materials),data:safeInt(input.resources?.data)};
  for(const id of Object.keys(RESEARCH))p.research[id]=input.research?.[id]===true;
  p.settings.reducedMotion=input.settings?.reducedMotion===true;
  if(Number.isFinite(input.settings?.sfxVolume))
    p.settings.sfxVolume=Math.max(0,Math.min(1,input.settings.sfxVolume));
  if(Number.isFinite(input.settings?.musicVolume))
    p.settings.musicVolume=Math.max(0,Math.min(1,input.settings.musicVolume));
  // Unlocks are derived from actual cleared missions, preventing corrupted skips.
  for(const id of MISSION_IDS.slice(1)){
    if(p.sectors[preceding(id)].victories>0)p.unlockedSectorIds.push(id);
    else break;
  }
  return p;
}
export function loadProgress(storage){
  try{
    const raw=(storage??globalThis.localStorage).getItem(SAVE_KEY);
    if(!raw)return {progress:newProgress(),warning:''};
    const parsed=JSON.parse(raw);
    if(!parsed||![1,2,3].includes(parsed.schemaVersion))
      return {progress:newProgress(),warning:'Неподдерживаемая версия сохранения. Начата новая экспедиция.'};
    const migrated=parsed.schemaVersion!==3;
    return {progress:sanitizeProgress(parsed),warning:migrated?'Сохранение предыдущей кампании перенесено в версию с 24 секторами.':''};
  }catch{
    return {progress:newProgress(),warning:'Повреждённое или недоступное сохранение. Прогресс этой сессии может не сохраняться.'};
  }
}
export function storeProgress(p,storage){
  try{(storage??globalThis.localStorage).setItem(SAVE_KEY,JSON.stringify(sanitizeProgress(p)));return true;}
  catch{return false;}
}
export function markBriefingSeen(p,id){p.sectors[id].briefingSeen=true;}
export function markAttempt(p,id){p.sectors[id].attempts++;}
export function grantVictory(p,id,stars){
  if(!MISSIONS[id]||!Number.isInteger(stars)||stars<1||stars>3)throw Error('Invalid mission result');
  const rec=p.sectors[id],first=!rec.firstVictoryClaimed,r=MISSIONS[id].rewards;
  const prize={
    materials:r.materials+(first?r.firstMaterials:0),
    data:r.data+(first?r.firstData:0),
    first
  };
  rec.bestStars=Math.max(rec.bestStars,stars);
  rec.victories++;rec.firstVictoryClaimed=true;
  p.resources.materials+=prize.materials;
  p.resources.data+=prize.data;
  const next=MISSION_IDS[MISSION_IDS.indexOf(id)+1];
  if(next&&!p.unlockedSectorIds.includes(next))p.unlockedSectorIds.push(next);
  return prize;
}
export function researchAvailable(p,id){
  const r=RESEARCH[id];
  if(!r)return {ok:false,reason:'Неизвестная технология'};
  if(p.research[id])return {ok:false,reason:'Технология уже изучена'};
  if(p.sectors[MISSION_IDS[r.after-1]].victories===0)return {ok:false,reason:'Доступно после сектора '+r.after};
  if(p.resources.materials<r.materials||p.resources.data<r.data)return {ok:false,reason:'Недостаточно ресурсов'};
  return {ok:true};
}
export function purchaseResearch(p,id){
  const can=researchAvailable(p,id);if(!can.ok)return can;
  const r=RESEARCH[id];
  p.resources.materials-=r.materials;p.resources.data-=r.data;
  p.research[id]=true;
  return {ok:true};
}
export function campaignComplete(p){return MISSION_IDS.every(id=>p.sectors[id].victories>0);}
export function unlockedEquipment(p){
  const count=MISSION_IDS.filter(id=>p.sectors[id].victories>0).length;
  return {
    towers:['kinetic',...(count>=1?['pulse']:[]),...(count>=3?['mortar']:[]),...(count>=4?['antiAir']:[]),
      ...(count>=6?['cryo']:[]),...(count>=12?['sonic']:[])],
    traps:count>=2?['mine','slow',...(count>=15?['lure']:[])]:[],
    units:count>=2?['drone',...(count>=9?['infantry']:[]),...(count>=18?['repair']:[])]:[]
  };
}
