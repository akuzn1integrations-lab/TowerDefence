import { ENEMIES, TOWERS, TRAPS, UNITS, cellKey, center } from './config.js';
import { towerRange } from './model.js';
import {
  drawTerrainTile,drawTower,drawEnemy,drawUnit,drawTrap,drawCore,drawResearchTeam,paletteFor
} from './art.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class Battlefield {
  constructor(canvas,onPick){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onPick=onPick;
    this.width=0;this.height=0;this.scale=35;this.camX=10;this.camY=6;
    this.initialized=false;this.dpr=1;this.terrain=null;this.pointerMap=new Map();this.drag=null;this.pinch=null;
    this.setupInput();
    this.observer=new ResizeObserver(()=>this.resize());
    this.observer.observe(canvas.parentElement);
  }
  setMission(state){
    this.state=state;
    const {width,height}=state.config.map;
    this.camX=width/2;this.camY=height/2;
    this.initialized=false;this.makeTerrain();this.resize();
  }
  resize(){
    const {width,height}=this.canvas.getBoundingClientRect();
    if(!width||!height)return;
    this.width=width;this.height=height;this.dpr=Math.min(window.devicePixelRatio||1,2);
    this.canvas.width=Math.round(width*this.dpr);this.canvas.height=Math.round(height*this.dpr);
    if(!this.initialized&&this.state){
      this.scale=clamp(Math.min(width/this.state.config.map.width,height/this.state.config.map.height),20,70);
      this.initialized=true;
    }
    this.clampCamera();
  }
  clampCamera(){
    if(!this.state)return;
    const {width,height}=this.state.config.map;
    const hW=this.width/(2*this.scale),hH=this.height/(2*this.scale);
    this.camX=hW>=width/2?width/2:clamp(this.camX,hW,width-hW);
    this.camY=hH>=height/2?height/2:clamp(this.camY,hH,height-hH);
  }
  toScreen(x,y){return {x:this.width/2+(x-this.camX)*this.scale,y:this.height/2+(y-this.camY)*this.scale};}
  toWorld(x,y){return {x:this.camX+(x-this.width/2)/this.scale,y:this.camY+(y-this.height/2)/this.scale};}
  changeZoom(factor,x=this.width/2,y=this.height/2){
    const before=this.toWorld(x,y);
    this.scale=clamp(this.scale*factor,18,125);
    const after=this.toWorld(x,y);
    this.camX+=before.x-after.x;this.camY+=before.y-after.y;this.clampCamera();
  }
  setupInput(){
    const cvs=this.canvas;
    const loc=e=>{const r=cvs.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
    cvs.addEventListener('pointerdown',e=>{
      if(e.button!==0 && e.pointerType==='mouse')return;
      const p=loc(e);this.pointerMap.set(e.pointerId,p);
      cvs.setPointerCapture(e.pointerId);
      if(this.pointerMap.size===1)this.drag={id:e.pointerId,start:p,camX:this.camX,camY:this.camY,moved:false};
      if(this.pointerMap.size===2){
        const [a,b]=[...this.pointerMap.values()];
        this.pinch={distance:Math.hypot(a.x-b.x,a.y-b.y)};
        this.drag=null;
      }
    });
    cvs.addEventListener('pointermove',e=>{
      if(!this.pointerMap.has(e.pointerId))return;
      const p=loc(e);this.pointerMap.set(e.pointerId,p);
      if(this.pointerMap.size>=2){
        const [a,b]=[...this.pointerMap.values()];
        const d=Math.hypot(a.x-b.x,a.y-b.y),focusX=(a.x+b.x)/2,focusY=(a.y+b.y)/2;
        if(this.pinch?.distance>0)this.changeZoom(d/this.pinch.distance,focusX,focusY);
        this.pinch={distance:d};return;
      }
      const drag=this.drag;
      if(drag&&drag.id===e.pointerId){
        if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>8)drag.moved=true;
        if(drag.moved){
          this.camX=drag.camX-(p.x-drag.start.x)/this.scale;
          this.camY=drag.camY-(p.y-drag.start.y)/this.scale;
          this.clampCamera();
        }
      }
    });
    const end=e=>{
      if(!this.pointerMap.has(e.pointerId))return;
      const p=loc(e),drag=this.drag;
      if(drag&&drag.id===e.pointerId&&!drag.moved&&this.pointerMap.size===1){
        const pos=this.toWorld(p.x,p.y);
        this.onPick(Math.floor(pos.x),Math.floor(pos.y),pos);
      }
      this.pointerMap.delete(e.pointerId);this.drag=null;
      if(this.pointerMap.size<2)this.pinch=null;
    };
    cvs.addEventListener('pointerup',end);
    cvs.addEventListener('pointercancel',e=>{this.pointerMap.delete(e.pointerId);this.drag=null;this.pinch=null;});
    cvs.addEventListener('wheel',e=>{
      e.preventDefault();const p=loc(e);
      this.changeZoom(e.deltaY<0?1.12:1/1.12,p.x,p.y);
    },{passive:false});
    cvs.addEventListener('contextmenu',e=>e.preventDefault());
  }
  makeTerrain(){
    if(!this.state)return;
    const {width,height,routes,buildCells,researchPath}=this.state.config.map;
    const tile=64,can=document.createElement('canvas');
    can.width=width*tile;can.height=height*tile;
    const c=can.getContext('2d');if(!c)return;
    const biome=this.state.config.biome;
    for(let row=0;row<height;row++)for(let col=0;col<width;col++)
      drawTerrainTile(c,col*tile,row*tile,tile,col,row,biome);
    // Roads follow the gameplay path exactly, not the illustration's approximate route.
    const routeColors=['#51606c','#8496a1','#c5d3d2'];
    for(const [routeId,route] of Object.entries(routes)){
      if(routeId==='air')continue;
      const drawRoute=(width,color,dash=[])=>{
        c.save();c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';
        c.setLineDash(dash);c.beginPath();
        route.forEach((pt,i)=>{const x=(pt.col+.5)*tile,y=(pt.row+.5)*tile;
          i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();c.restore();
      };
      drawRoute(tile*.68,'#0c1d2eaa');
      drawRoute(tile*.57,'#5d6a70');
      drawRoute(tile*.41,'#8b9192b6');
      drawRoute(2,'#deeff077',[tile*.11,tile*.22]);
    }
    // Industrial hexagonal sockets are always precisely on legal tower cells.
    for(const {col,row} of buildCells){
      const x=(col+.5)*tile,y=(row+.5)*tile;
      c.fillStyle='#071c2cdd';c.strokeStyle='#8ee7f9aa';c.lineWidth=2.2;
      c.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3+Math.PI/6;
        const X=x+Math.cos(a)*tile*.34,Y=y+Math.sin(a)*tile*.34;
        i?c.lineTo(X,Y):c.moveTo(X,Y);
      }c.closePath();c.fill();c.stroke();
      c.strokeStyle='#62d7f988';c.lineWidth=1;
      c.beginPath();c.arc(x,y,tile*.24,0,Math.PI*2);c.stroke();
      for(let i=0;i<3;i++){const a=i*2*Math.PI/3;
        c.fillStyle=i?'#ffa862':'#7cefff';
        c.fillRect(x+Math.cos(a)*tile*.27-2,y+Math.sin(a)*tile*.27-2,4,4);
      }
    }
    for(const [routeId,route] of Object.entries(routes)){
      if(routeId!=='air')continue;
      c.save();c.strokeStyle='#74e7ff9c';c.lineWidth=3;c.setLineDash([11,15]);
      c.beginPath();route.forEach((pt,i)=>i?
        c.lineTo((pt.col+.5)*tile,(pt.row+.5)*tile):
        c.moveTo((pt.col+.5)*tile,(pt.row+.5)*tile));c.stroke();c.restore();
    }
    if(researchPath.length){
      c.save();c.setLineDash([9,13]);c.strokeStyle='#a5ffb6c9';c.lineWidth=3;
      c.beginPath();researchPath.forEach((p,i)=>i?c.lineTo((p.col+.5)*tile,(p.row+.5)*tile):
        c.moveTo((p.col+.5)*tile,(p.row+.5)*tile));c.stroke();c.restore();
    }
    this.terrain=can;
  }
  health(x,y,w,hp,max,color){
    const c=this.ctx,ratio=Math.min(1,Math.max(0,hp/Math.max(1,max)));
    c.fillStyle='#04101be0';c.fillRect(x-w/2-2,y-2,w+4,7);
    c.fillStyle='#334d61';c.fillRect(x-w/2,y,w,3);
    c.fillStyle=color;c.fillRect(x-w/2,y,w*ratio,3);
  }
  range(x,y,r){
    const c=this.ctx,p=this.toScreen(x,y);
    c.beginPath();c.arc(p.x,p.y,r*this.scale,0,Math.PI*2);
    c.strokeStyle='#8df6ffb0';c.fillStyle='#46d9ed18';c.lineWidth=1.6;c.fill();c.stroke();
  }
  render(state,{selectedCell=null,selectedId=null,selectedType='kinetic',paused=false,mode='build'}={}){
    if(!this.width||!this.height||!this.ctx||!state)return;
    const c=this.ctx,s=this.scale,map=state.config.map;
    const reduced=Boolean(document.documentElement.classList.contains('reduced-motion'));
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    c.clearRect(0,0,this.width,this.height);
    c.fillStyle='#071927';c.fillRect(0,0,this.width,this.height);
    const start=this.toScreen(0,0),width=s*map.width,height=s*map.height;
    if(this.terrain)c.drawImage(this.terrain,start.x,start.y,width,height);
    // Quiet holographic grid that continues to be readable at higher zoom.
    if(s>=28){c.strokeStyle='#9acbf113';c.lineWidth=.6;c.beginPath();
      const firstX=Math.max(0,Math.floor((this.camX-this.width/(2*s))));
      const lastX=Math.min(map.width,Math.ceil(this.camX+this.width/(2*s)));
      const firstY=Math.max(0,Math.floor((this.camY-this.height/(2*s))));
      const lastY=Math.min(map.height,Math.ceil(this.camY+this.height/(2*s)));
      for(let i=firstX;i<=lastX;i++){const x=this.toScreen(i,0).x;c.moveTo(x,0);c.lineTo(x,this.height);}
      for(let i=firstY;i<=lastY;i++){const y=this.toScreen(0,i).y;c.moveTo(0,y);c.lineTo(this.width,y);}
      c.stroke();
    }
    for(const [name,route] of Object.entries(map.routes)){
      if(!route.length)continue;
      const p=this.toScreen(route[0].col+.5,route[0].row+.5);
      c.strokeStyle=name==='air'?'#9bdcff':'#ffb27f';c.lineWidth=2.2;
      c.beginPath();c.arc(p.x,p.y,Math.max(5,s*.28),0,Math.PI*2);c.stroke();
      c.fillStyle=name==='air'?'#a8ecff':'#ffc184';c.font='700 '+Math.max(11,s*.27)+'px sans-serif';
      c.textAlign='center';c.textBaseline='middle';c.fillText(name==='air'?'✦':'➜',p.x,p.y);
    }
    if(state.config.allowed.traps.length)for(const tile of map.trapCells){
      if(state.traps.some(t=>t.col===tile.col&&t.row===tile.row))continue;
      const p=this.toScreen(tile.col+.5,tile.row+.5);
      c.strokeStyle='#ffc27161';c.lineWidth=1.6;c.beginPath();c.arc(p.x,p.y,s*.18,0,Math.PI*2);c.stroke();
    }
    if(map.relaySites?.length)map.relaySites.forEach((site,i)=>{
      const p=this.toScreen(site.col+.5,site.row+.5),complete=i<state.relayIndex,active=i===state.relayIndex;
      c.save();c.translate(p.x,p.y);
      c.fillStyle=complete?'#1f6e67':active?'#775f33':'#213a53';
      c.strokeStyle=complete?'#7dffc2':active?'#ffe096':'#7eb8d6';c.lineWidth=2.2;
      c.beginPath();c.arc(0,0,s*.35,0,Math.PI*2);c.fill();c.stroke();
      c.fillStyle='#f0fffd';c.font='700 '+Math.max(10,s*.27)+'px sans-serif';
      c.textAlign='center';c.textBaseline='middle';c.fillText(String(i+1),0,0);
      if(active&&!reduced){c.beginPath();c.arc(0,0,s*(.43+Math.sin(state.time*2)*.035),0,Math.PI*2);c.strokeStyle='#ffedab88';c.stroke();}
      c.restore();
    });
    const target=this.toScreen(map.target.x,map.target.y);
    if(!reduced){
      c.save();c.strokeStyle='#67e6ff46';c.lineWidth=1.2;c.beginPath();
      c.arc(target.x,target.y,s*(.48+Math.sin(state.time*2)*.035),0,Math.PI*2);c.stroke();c.restore();
    }
    drawCore(c,target.x,target.y,s*1.4,state.time,reduced);
    this.health(target.x,target.y-s*.61,Math.max(18,s*.95),state.targetHp,state.config.objective.maxHp,'#66e8f1');
    const selected=state.towers.find(t=>t.id===selectedId)||state.units.find(u=>u.id===selectedId);
    if(selected?.level)this.range(selected.col+.5,selected.row+.5,towerRange(selected));
    if(selected?.to)this.range(selected.x,selected.y,2.8);
    if(selectedCell&&mode==='build'&&TOWERS[selectedType])
      this.range(selectedCell.col+.5,selectedCell.row+.5,TOWERS[selectedType].range);
    for(const t of state.traps){const p=this.toScreen(t.col+.5,t.row+.5);
      drawTrap(c,t.type,p.x,p.y,s*.94,state.time,reduced);}
    for(const t of state.towers){const p=this.toScreen(t.col+.5,t.row+.5);
      drawTower(c,t.type,p.x,p.y,s*1.12,state.time,t.level,reduced);}
    for(const u of state.units){if(u.hp<=0)continue;const p=this.toScreen(u.x,u.y);
      drawUnit(c,u.type,p.x,p.y,s*1.12,state.time,reduced);
      this.health(p.x,p.y-s*.45,Math.max(15,s*.62),u.hp,u.maxHp,'#75eecf');
    }
    if(state.team){const p=this.toScreen(state.team.position.x,state.team.position.y);
      drawResearchTeam(c,p.x,p.y,s*1.18,state.time);
      this.health(p.x,p.y-s*.53,Math.max(18,s*.9),state.team.hp,state.team.maxHp,'#a1ffd4');
    }
    for(const e of state.enemies){
      const p=this.toScreen(e.x,e.y),def=ENEMIES[e.type];
      const factor=def.boss?1.78:e.type==='crawler'||e.type==='shell'?1.2:def.air?1.15:.93;
      drawEnemy(c,e.type,p.x,p.y,s*factor,state.time,reduced);
      this.health(p.x,p.y-s*(def.boss?.86:.44),Math.max(17,s*(def.boss?1.24:.69)),e.hp,e.maxHp,'#ff728e');
      if(e.slowed>0){c.strokeStyle='#89dcffe0';c.beginPath();c.arc(p.x,p.y,s*.3,0,Math.PI*2);c.stroke();}
    }
    if(!reduced)for(const e of state.effects){
      const from=this.toScreen(e.x,e.y),to=this.toScreen(e.tx,e.ty);
      const alpha=Math.min(1,Math.max(0,e.life/.14));
      c.save();c.globalAlpha=alpha;
      c.shadowColor=e.blast?'#ffb469':'#67dfff';c.shadowBlur=9;
      c.strokeStyle=e.blast?'#ffb469':'#e7ffff';c.lineWidth=e.blast?2:2.6;
      c.beginPath();c.moveTo(from.x,from.y);c.lineTo(to.x,to.y);c.stroke();
      c.fillStyle=e.blast?'#ffbd71':'#abffff';c.beginPath();c.arc(to.x,to.y,e.blast?s*.25:3,0,Math.PI*2);c.fill();
      c.restore();
    }
    if(selectedCell&&mode==='build'){
      const p=this.toScreen(selectedCell.col,selectedCell.row);
      c.strokeStyle='#ffe292';c.lineWidth=2.5;c.strokeRect(p.x+2,p.y+2,s-4,s-4);
      c.fillStyle='#fae28b1c';c.fillRect(p.x+2,p.y+2,s-4,s-4);
    }
    // Compact minimap is drawn independently of camera and remains accurate at any aspect ratio.
    if(this.width>=420&&this.height>=240){
      const w=Math.min(150,this.width*.24),h=w*map.height/map.width,x=12,y=this.height-h-58;
      c.fillStyle='#071827ed';c.fillRect(x-4,y-4,w+8,h+8);
      c.strokeStyle='#56b4d2b0';c.lineWidth=1.2;c.strokeRect(x-4,y-4,w+8,h+8);
      c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
      if(this.terrain)c.drawImage(this.terrain,x,y,w,h);
      for(const e of state.enemies){c.fillStyle='#ff5e81';c.fillRect(x+e.x/map.width*w-1.5,y+e.y/map.height*h-1.5,3,3);}
      for(const t of state.towers){c.fillStyle='#8df5ff';c.fillRect(x+(t.col+.5)/map.width*w-1,y+(t.row+.5)/map.height*h-1,2,2);}
      const camW=this.width/this.scale,camH=this.height/this.scale;
      c.strokeStyle='#c9faff';c.lineWidth=1.2;c.strokeRect(x+(this.camX-camW/2)/map.width*w,
        y+(this.camY-camH/2)/map.height*h,Math.min(w,camW/map.width*w),Math.min(h,camH/map.height*h));
      c.restore();
    }
    if(paused){
      c.fillStyle='#07111eb9';c.fillRect(0,0,this.width,this.height);
      c.textAlign='center';c.fillStyle='#c0faff';c.font='700 25px sans-serif';c.fillText('⏸  ПАУЗА',this.width/2,this.height/2);
    }
  }
}
