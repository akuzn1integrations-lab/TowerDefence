// Zero-dependency Chromium smoke check via Chrome DevTools Protocol (Node 22).
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';

const locations=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/chromium',
  '/usr/bin/google-chrome-stable','/usr/bin/chromium-browser'].filter(Boolean);
const chrome=locations.find(existsSync)||['google-chrome','chromium'].find(name=>
  spawnSync('which',[name],{stdio:'ignore'}).status===0);
if(!chrome){
  console.log('SKIP: Chromium/Chrome not found; browser smoke test unavailable here.');
  process.exit(0);
}
const port=4183,debug=9369;
const profile=mkdtempSync(join(tmpdir(),'nova7-browser-'));
const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});
let browser,ws;
async function fetchJson(url){try{const r=await fetch(url);return r.ok?await r.json():null;}catch{return null;}}
async function waitFor(get,limit=120){
  for(let i=0;i<limit;i++){const v=await get();if(v)return v;await sleep(100);}
  throw Error('Browser smoke timeout');
}
try{
  await waitFor(async()=>{try{return (await fetch('http://127.0.0.1:'+port+'/')).ok;}catch{return false;}},70);
  browser=spawn(chrome,[
    '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
    '--no-first-run','--remote-allow-origins=*','--remote-debugging-port='+debug,
    '--user-data-dir='+profile,'--window-size=1280,800','http://127.0.0.1:'+port+'/'
  ],{stdio:'ignore'});
  const tab=await waitFor(async()=>{
    const pages=await fetchJson('http://127.0.0.1:'+debug+'/json');
    return pages?.find(p=>p.type==='page'&&p.url.startsWith('http://127.0.0.1:'+port));
  });
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let index=0;
  const requests=new Map();
  ws.onmessage=e=>{
    const v=JSON.parse(e.data);
    if(!v.id||!requests.has(v.id))return;
    const {resolve,reject}=requests.get(v.id);
    requests.delete(v.id);
    v.error?reject(Error(v.error.message)):resolve(v.result);
  };
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++index;requests.set(id,{resolve,reject});
    ws.send(JSON.stringify({id,method,params}));
  });
  const run=async expression=>{
    const v=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(v.exceptionDetails)throw Error('Page error: '+(v.exceptionDetails.exception?.description||v.exceptionDetails.text));
    return v.result.value;
  };
  const check=async(expression,label)=>assert.equal(await run(expression),true,label);
  await waitFor(()=>run("document.documentElement?.dataset?.appReady==='true'"));
  await check("document.querySelector('#screen-home').classList.contains('active')",'home');
  await run("document.querySelector('#continueButton').click()");
  await check("document.querySelector('#screen-camp').classList.contains('active')",'camp');
  await run("document.querySelector('#toMap').click()");
  await check("document.querySelectorAll('#sectorNodes button').length===6",'six sectors');
  await run("document.querySelector('#mapPlay').click()");
  await check("document.querySelector('#screen-briefing').classList.contains('active')",'briefing');
  await run("document.querySelector('#briefSkip').click()");
  await check("document.querySelector('#screen-mission').classList.contains('active')",'battle');
  await check("document.querySelector('#field').width>0",'canvas');
  await check("document.querySelectorAll('#equipmentList button').length>=2",'equipment');
  const point=await run("(()=>{const r=document.querySelector('#field').getBoundingClientRect();const s=Math.max(20,Math.min(70,Math.min(r.width/20,r.height/12)));return {x:r.left+r.width/2+(2.5-10)*s,y:r.top+r.height/2+(4.5-6)*s};})()");
  await call('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
  await check("document.querySelector('#confirmBuild').disabled===false",'building preview');
  await run("document.querySelector('#confirmBuild').click()");
  await check("document.querySelector('#hudSupply').textContent.includes('300')",'construction deducted supply');
  await run("document.querySelector('#startWave').click()");
  await check("document.querySelector('#hudWave').textContent.includes('1 / 3')",'wave');
  await run("document.querySelector('#pauseButton').click()");
  await check("document.querySelector('#pauseButton').textContent.includes('Продолжить')",'pause');
  await run("document.querySelector('#quitMission').click()");
  await run("document.querySelector('#quitConfirm').click()");
  await check("document.querySelector('#screen-camp').classList.contains('active')",'exit battle');
  await run("document.querySelector('#archiveShortcut').click()");
  await check("document.querySelectorAll('#archiveSectors .archive-entry').length===6",'archive');
  await run("document.querySelector('#settingsShortcut').click()");
  await check("document.querySelector('#screen-settings').classList.contains('active')",'settings');
  await run("(()=>{const x=document.querySelector('#sfxVolume');x.value='25';x.dispatchEvent(new Event('input',{bubbles:true}));return true})()");
  await check("JSON.parse(localStorage.getItem('towerdefence-nova7-v1')).settings.sfxVolume===.25",'save settings');
  for(const [width,height] of [[360,800],[390,844],[800,360],[768,1024],[523,523],[1920,1080]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:width<1000});
    await sleep(100);
    await check("document.documentElement.scrollWidth<=window.innerWidth+1",'horizontal overflow '+width+'x'+height);
  }
  await run("document.querySelector('#settingsBack').click()");
  await check("document.querySelector('#screen-archive').classList.contains('active')",'back from settings');
  console.log('PASS: Chromium — desktop/mobile, construction, menu, camp, map, briefing, battle, pause, archive, settings, save');
}finally{
  try{ws?.close();}catch{}
  try{browser?.kill('SIGKILL');}catch{}
  try{server.kill('SIGKILL');}catch{}
  try{rmSync(profile,{recursive:true,force:true});}catch{}
}
