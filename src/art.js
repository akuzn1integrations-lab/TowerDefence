// NOVA–7 art renderer. All sprites use the same top-down shapes in the HUD and on the battlefield.
// No remote assets, DOM access, randomness or game-state mutations.
export const ART_COLORS = Object.freeze({
  cyan:'#72edff',blue:'#48a8ff',white:'#e7f8fc',steel:'#91a7b8',
  metal:'#304154',shadow:'#071521',orange:'#ffab56',gold:'#fbd685',
  violet:'#cf61ff',purple:'#8b43db',red:'#ff6e7f',green:'#88efc9'
});
export const BIOME_ART = Object.freeze({
  'Посадочная долина': ['#746b65','#4c5662','#b79d79','#58d9ff','rock'],
  'Кремниевые ущелья':['#526276','#313e51','#8396b0','#9b83ff','slate'],
  'Светящиеся болота':['#244f57','#173944','#4a857c','#57f9d2','marsh'],
  'Тектонический разлом':['#463840','#282b3a','#76606a','#ffa24c','lava'],
  'Кристальное плато':['#4c3d69','#292c51','#786c9e','#d67bff','crystal'],
  'Кроны гигантов':['#24483e','#17342f','#3d775f','#62e8ce','forest'],
  'Обсидиановые дюны':['#49404b','#292938','#70616b','#ff815a','dunes'],
  'Кратер сияния':['#344e70','#1d344e','#627e9e','#83dfff','crater']
});
export const paletteFor=biome=>BIOME_ART[biome]||BIOME_ART['Посадочная долина'];
const TAU=Math.PI*2;
const hash=(x,y,k=0)=>{let n=(x*374761393+y*668265263+k*2147483647)|0;n=(n^(n>>>13))*1274126177;return ((n^(n>>>16))>>>0)/4294967295;};
function path(c,points,color,stroke=null,width=1){
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  if(color){c.fillStyle=color;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
function ring(c,r,color,w=2){c.beginPath();c.arc(0,0,r,0,TAU);c.strokeStyle=color;c.lineWidth=w;c.stroke();}
function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
function point(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();}
function hex(c,r,color,outline='#a7c9dc',rotation=Math.PI/6){
  const p=Array.from({length:6},(_,i)=>[Math.cos(i*TAU/6+rotation)*r,Math.sin(i*TAU/6+rotation)*r]);
  path(c,p,color,outline,1.1);
}
function light(c,x,y,r,color){c.save();c.shadowColor=color;c.shadowBlur=8;point(c,x,y,r,color);c.restore();}
function plating(c,size=1){
  ellipse(c,0,5,25*size,11*size,'#040b12a8');
  hex(c,24*size,'#162637','#050f1e',2*Math.PI/12);
  hex(c,20*size,'#344657','#83a4b8');
  hex(c,15*size,'#1d3549','#132130');
  for(let i=0;i<6;i++){const a=i*TAU/6;box(c,Math.cos(a)*19*size-2,Math.sin(a)*19*size-2,4,4,i%2?ART_COLORS.orange:ART_COLORS.cyan);}
  ring(c,12*size,'#4e778b',1.2);
}
function barrel(c,angle,length=28,width=7,accent='#71d9ff'){
  c.save();c.rotate(angle);
  box(c,-width/2,-length*.79,width,length,'#101e2e');
  box(c,-width*.33,-length*.75,width*.65,length*.72,'#a0b7c4');
  box(c,-width*.18,-length*.85,width*.36,length*.42,accent);
  box(c,-width*.53,-length*.98,width*1.06,4,'#304353');
  light(c,0,-length*.96,2,accent);c.restore();
}
const TOWER_ACCENTS={kinetic:'#72caff',pulse:'#53ecff',mortar:'#ffae67',antiAir:'#ffba68',cryo:'#8debff',sonic:'#c98dff'};
export function drawTower(c,type,x,y,size=44,time=0,level=1,reduced=false){
  const a=TOWER_ACCENTS[type]||ART_COLORS.cyan;
  c.save();c.translate(x,y);c.scale(size/64,size/64);
  plating(c);c.save();
  c.shadowColor=a;c.shadowBlur=reduced?0:7;
  if(type==='kinetic'){
    hex(c,12,'#a1b2bb','#1d2a40');barrel(c,-.19,27,6,a);barrel(c,.19,27,6,a);
    hex(c,9,'#3a4b5e');light(c,0,1,4,a);
  }else if(type==='pulse'){
    hex(c,12,'#7996a6');for(let i=0;i<4;i++){let th=i*TAU/4;point(c,Math.cos(th)*12,Math.sin(th)*12,4,'#233c55');}
    hex(c,9,'#1cbcc7','#a9faff',Math.PI/6+Math.sin(time*2)*.06);
    light(c,0,0,5,'#c2fbff');ring(c,12+Math.sin(time*2)*1.2,'#82efffd0',2);
  }else if(type==='mortar'){
    hex(c,13,'#758391');box(c,-11,-9,22,17,'#263a4b');barrel(c,-.15,28,13,'#ffb65d');
    ring(c,8,'#e4a56e',2);point(c,0,0,4,'#202c3b');
  }else if(type==='antiAir'){
    hex(c,11,'#99a7b9');barrel(c,-.37,29,8,'#ffc17c');barrel(c,.37,29,8,'#ffc17c');
    point(c,0,0,7,'#1b3547');light(c,0,0,3,'#80f2ff');
  }else if(type==='cryo'){
    hex(c,13,'#536e84');for(let i=0;i<5;i++){const th=i*TAU/5;path(c,[[0,-5],[5,-18],[0,-27],[-5,-18]].map(([a,b])=>[a+Math.sin(th)*6,b+Math.cos(th)*6]),'#62cfee','#dffbff');}
    path(c,[[0,-24],[10,-7],[6,9],[-5,9],[-11,-5]],'#4dd5ff','#f6ffff',2);light(c,0,-5,5,'#edffff');
  }else if(type==='sonic'){
    hex(c,14,'#708ba8');ring(c,17,'#bc90ff',2);ring(c,10,'#7eecff',3);light(c,0,0,7,'#d1a1ff');
    for(let i=0;i<4;i++){const th=time*.25+i*TAU/4;point(c,Math.cos(th)*15,Math.sin(th)*15,3,'#85efff');}
  }else{hex(c,10,'#779cad');light(c,0,0,4,a);}
  c.restore();
  if(level>1){ring(c,25,'#ffda82',1.4);for(let i=0;i<level;i++){const a=i*TAU/level;point(c,Math.cos(a)*24,Math.sin(a)*24,2,'#ffdf91');}}
  c.restore();
}
export function drawTrap(c,type,x,y,size=37,time=0,reduced=false){
  c.save();c.translate(x,y);c.scale(size/64,size/64);
  ellipse(c,0,4,23,10,'#040e17a8');hex(c,20,'#202f45','#899fa8');ring(c,14,'#f5bd64',2);
  if(type==='mine'){
    for(let i=0;i<6;i++){c.save();c.rotate(i*TAU/6);box(c,-3,-25,6,9,'#91b4c6');c.restore();}
    light(c,0,0,8,'#7cf3ff');
  }else if(type==='slow'){
    ring(c,8+Math.sin(time*2)*2,'#8bd5ff',3);ring(c,17,'#69aaff',1);
    hex(c,8,'#4eacb8');light(c,0,0,4,'#d0fbff');
  }else{
    for(let i=0;i<3;i++)ring(c,9+i*5+(time%2)*2,'#87caff77',1);
    box(c,-4,-12,8,15,'#859cb0');light(c,0,-13,4,'#ffba59');
  }c.restore();
}
const UNIT_ACCENTS={drone:'#64edff',infantry:'#e4b57e',repair:'#85ffc4'};
export function drawUnit(c,type,x,y,size=42,time=0,reduced=false){
  c.save();c.translate(x,y+Math.sin(time*3)*(!reduced&&type==='drone'?1.5:0));c.scale(size/64,size/64);
  ellipse(c,0,6,20,9,'#06121b9a');
  if(type==='drone'){
    for(let i=0;i<4;i++){const a=i*TAU/4+Math.PI/4,X=Math.cos(a)*18,Y=Math.sin(a)*18;
      c.strokeStyle='#91b1bd';c.lineWidth=5;c.beginPath();c.moveTo(0,0);c.lineTo(X,Y);c.stroke();
      point(c,X,Y,8,'#173047');ringAt(c,X,Y,6,'#5eebff',2);point(c,X,Y,2,'#baffff');
    }
    hex(c,11,'#abc0c9','#122b42');light(c,0,0,4,'#63edff');
  }else if(type==='infantry'){
    box(c,-13,-18,7,9,'#cbd1d1');box(c,6,-18,7,9,'#cbd1d1');
    hex(c,16,'#8197a3','#e8b977');box(c,-5,-24,10,16,'#24394b');
    barrel(c,.3,24,7,'#78d8ff');light(c,0,-8,5,'#7af0ff');
    box(c,-12,12,9,8,'#4d6579');box(c,3,12,9,8,'#4d6579');
  }else{
    for(let i=0;i<4;i++){let a=i*TAU/4+Math.PI/4;box(c,Math.cos(a)*16-4,Math.sin(a)*16-3,8,7,'#a1b0b5');}
    hex(c,17,'#789bab','#203b50');box(c,5,-20,5,24,'#c7d2d2');
    c.strokeStyle='#83fcb5';c.lineWidth=4;c.beginPath();c.moveTo(-6,0);c.lineTo(6,0);c.moveTo(0,-6);c.lineTo(0,6);c.stroke();
    light(c,0,0,3,'#adffdb');
  }
  c.restore();
}
function ringAt(c,x,y,r,color,width=1){c.beginPath();c.arc(x,y,r,0,TAU);c.lineWidth=width;c.strokeStyle=color;c.stroke();}
const ENEMY_STYLE={
  skitter:['#472343','#de6aff','small'],shell:['#463b37','#ffa15c','armored'],
  runner:['#282c48','#d55aff','fast'],flyer:['#29304e','#af8cff','wings'],
  spore:['#254b4b','#65f7bd','spores'],leader:['#51264b','#fc68dc','leader'],
  glider:['#34294e','#d490ff','wings'],crawler:['#34353e','#ff9653','armored'],
  stalker:['#2e2146','#c16bff','fast'],titan:['#23374d','#79ceff','boss'],
  monarch:['#382445','#ef63ff','boss']
};
export function drawEnemy(c,type,x,y,size=32,time=0,reduced=false){
  const [base,glow,shape]=ENEMY_STYLE[type]||ENEMY_STYLE.skitter;
  c.save();c.translate(x,y);c.scale(size/64,size/64);
  ellipse(c,0,9,shape==='boss'?26:20,9,'#0a0c1c99');
  if(shape==='wings'){
    const flap=reduced?1:Math.cos(time*9)*.2+1;
    path(c,[[-4,-5],[-29*flap,-21],[-30,-3],[-8,8]],'#5a337b',glow,2);
    path(c,[[4,-5],[29*flap,-21],[30, -3],[8,8]],'#5a337b',glow,2);
  }else{
    for(let i=0;i<3;i++){
      for(const sign of [-1,1]){
        const y=-12+i*11, length=shape==='boss'?35:shape==='fast'?28:23;
        c.beginPath();c.moveTo(sign*9,y);c.lineTo(sign*length,y+7);c.lineTo(sign*(length+5),y+13);
        c.strokeStyle=i%2?base:glow;c.lineWidth=shape==='boss'?5:3.5;c.stroke();
      }
    }
  }
  if(shape==='armored'||shape==='boss'){
    hex(c,shape==='boss'?24:21,base,glow);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2;
      path(c,[[0,-25],[8,-6],[-8,-6]].map(([X,Y])=>[X+Math.sin(a)*8,Y+Math.cos(a)*8]),'#647185',glow,.7);
    }
  }else if(shape==='fast')path(c,[[0,-27],[12,-11],[10,11],[0,25],[-10,11],[-12,-11]],base,glow,2);
  else hex(c,18,base,glow);
  if(shape==='spores')for(let i=0;i<5;i++){const a=i*TAU/5;light(c,Math.cos(a)*10,Math.sin(a)*11,4,'#60f9cb');}
  if(shape==='leader'){ring(c,25,glow,2);for(let i=0;i<3;i++)point(c,Math.cos(i*TAU/3)*23,Math.sin(i*TAU/3)*23,3,glow);}
  if(shape==='boss')ring(c,26,glow,2);
  light(c,0,-4,shape==='boss'?7:5,glow);
  c.restore();
}
export function drawCore(c,x,y,size=68,time=0,reduced=false){
  c.save();c.translate(x,y);c.scale(size/80,size/80);
  ellipse(c,0,15,33,15,'#04151bc4');hex(c,34,'#213a50','#a2c3cf');
  hex(c,28,'#465c6c','#61cce5');hex(c,19,'#152f4b','#9bedfb');
  ring(c,30,'#72eafa',2.2);
  for(let i=0;i<6;i++){const a=i*TAU/6;light(c,Math.cos(a)*28,Math.sin(a)*28,3,i%2?'#ffbb6a':'#81f0ff');}
  light(c,0,0,9,'#adfbff');if(!reduced)ring(c,15+Math.sin(time*2)*2,'#c1fbff99',2);
  c.restore();
}
export function drawResearchTeam(c,x,y,size=44,time=0){
  c.save();c.translate(x,y);c.scale(size/60,size/60);
  ellipse(c,0,5,22,9,'#0b1c24bb');hex(c,23,'#8b9c85','#f8edbb');
  box(c,-12,-8,24,16,'#d9e4cb');box(c,-8,-15,16,9,'#38565c');
  light(c,0,-9,5,'#b9f5ef');c.restore();
}
export function drawTerrainTile(c,x,y,s,col,row,biome){
  const [ground,dark,bright,accent,kind]=paletteFor(biome),v=hash(col,row),v2=hash(col,row,9);
  box(c,x,y,s+.5,s+.5,v<.40?ground:v<.83?dark:bright);
  c.save();c.beginPath();c.rect(x,y,s,s);c.clip();
  // Layered mineral sediment, alien flora and broken ground are deterministic.
  c.globalAlpha=.26;
  for(let i=0;i<3;i++){
    const px=x+(hash(col,row,i+3)*.8+.1)*s,py=y+(hash(col,row,i+12)*.8+.1)*s;
    ellipse(c,px,py,s*(.06+hash(col,row,i+7)*.12),s*.05,i%2?bright:dark);
  }
  c.globalAlpha=1;
  if(kind==='rock'||kind==='slate'){
    if(v>.62){const px=x+s*.46,py=y+s*.47,sz=s*(.15+.1*v2);
      path(c,[[px-sz,py+sz*.6],[px-sz*.7,py-sz],[px+sz*.4,py-sz*.9],[px+sz,py+sz*.5]],'#263545','#aec6c260',.8);
      path(c,[[px-sz*.7,py-sz],[px+sz*.4,py-sz*.9],[px,py]],'#78909a70');
    }
    if(v2>.82)light(c,x+s*.24,y+s*.66,Math.max(1,s*.036),accent);
  }else if(kind==='marsh'||kind==='forest'){
    if(v>.43){const px=x+s*.63,py=y+s*.36;ellipse(c,px,py,s*.2,s*.1,'#143a48');
      point(c,px,py-s*.09,s*.09,'#62d9ca');point(c,px,py-s*.10,s*.04,'#b7e6fe');}
    if(v2>.65){point(c,x+s*.23,y+s*.74,s*.07,accent);ringAt(c,x+s*.23,y+s*.74,s*.09,'#a4dff077',1);}
  }else if(kind==='lava'||kind==='dunes'){
    if(v>.4){c.strokeStyle=kind==='lava'?'#fa8654aa':'#c7645485';c.lineWidth=Math.max(1,s*.035);
      c.beginPath();c.moveTo(x+s*.1,y+s*.9);c.lineTo(x+s*.4,y+s*.55);c.lineTo(x+s*.8,y+s*.59);c.stroke();}
  }else if(kind==='crystal'||kind==='crater'){
    if(v>.54){const px=x+s*.63,py=y+s*.63,h=s*(.28+.2*v2);
      path(c,[[px,py-h],[px+h*.32,py-h*.15],[px+h*.1,py+h*.3],[px-h*.28,py+h*.15]],accent,'#e8d6ff88',.7);
      path(c,[[px,py-h],[px+h*.1,py+h*.3],[px,py]],'#bde5ff66');
    }
    if(kind==='crater'&&v2>.7)ringAt(c,x+s*.3,y+s*.3,s*.13,accent+'88',1);
  }
  c.restore();
}
export function iconDataURL(type,kind='tower',size=86){
  if(typeof document==='undefined')return '';
  const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const c=canvas.getContext('2d');if(!c)return '';
  const f={tower:drawTower,trap:drawTrap,unit:drawUnit,enemy:drawEnemy}[kind]||drawTower;
  f(c,type,size/2,size/2,size*.86,0);
  return canvas.toDataURL('image/png');
}
