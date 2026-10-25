import { ENEMIES, TOWERS, TRAPS, UNITS, cellKey, center } from './config.js';
import { towerRange } from './model.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class Battlefield {
  constructor(canvas,onPick){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onPick=onPick;
    this.width=0;this.height=0;this.scale=35;this.camX=10;this.camY=6;
    this.initialized=false;this.dpr=1;this.pointerMap=new Map();this.drag=null;this.pinch=null;
    this.setupInput();
    this.observer=new ResizeObserver(()=>this.resize());
    this.observer.observe(canvas.parentElement);
  }
  setMission(state){
    this.state=state;
    const {width,height}=state.config.map;
    this.camX=width/2;this.camY=height/2;
    this.initialized=false;this.resize();
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
  health(x,y,w,hp,max,color){
    const c=this.ctx;
    c.fillStyle='#061d26';c.fillRect(x-w/2,y,w,4);
    c.fillStyle=color;c.fillRect(x-w/2,y,w*clamp(hp/max,0,1),4);
  }
  range(x,y,r){
    const c=this.ctx,p=this.toScreen(x,y);
    c.beginPath();c.arc(p.x,p.y,r*this.scale,0,Math.PI*2);
    c.strokeStyle='#9afcebb0';c.fillStyle='#5deaca13';c.lineWidth=1.2;c.fill();c.stroke();
  }
  render(state,{selectedCell=null,selectedId=null,selectedType='kinetic',paused=false,mode='build'}={}){
    if(!this.width||!this.height||!this.ctx||!state)return;
    const c=this.ctx,s=this.scale,map=state.config.map;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    c.fillStyle='#091d2b';c.fillRect(0,0,this.width,this.height);
    for(let row=0;row<map.height;row++)for(let col=0;col<map.width;col++){
      const p=this.toScreen(col,row);
      if(p.x+s<0||p.x>this.width||p.y+s<0||p.y>this.height)continue;
      const n=(col*43+row*27+col*row*11)%13;
      c.fillStyle=n<4?'#214845':n<8?'#1c403f':'#183b3e';
      c.fillRect(p.x+1,p.y+1,s-2,s-2);
      c.strokeStyle='#79bcb814';c.lineWidth=1;c.strokeRect(p.x+.5,p.y+.5,s,s);
      if(n===3){c.fillStyle='#8fbd9223';c.beginPath();c.arc(p.x+s*.45,p.y+s*.55,s*.11,0,Math.PI*2);c.fill();}
    }
    for(const [routeId,route] of Object.entries(map.routes)){
      const airborne=routeId==='air',color=airborne?'#79c7ed':'#3a6469';
      if(!airborne)for(const tile of route){
        const p=this.toScreen(tile.col,tile.row);c.fillStyle=color;c.fillRect(p.x+1,p.y+1,s-2,s-2);
      }
      c.beginPath();route.forEach((tile,i)=>{const p=this.toScreen(tile.col+.5,tile.row+.5);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});
      c.strokeStyle=airborne?'#9de5ffcf':'#b3e3d58c';c.lineWidth=airborne?3:1.6;c.setLineDash([s*.26,s*.25]);c.stroke();c.setLineDash([]);
      const start=this.toScreen(route[0].col+.5,route[0].row+.5);
      c.fillStyle=airborne?'#8dcefa':'#e4a981';
      c.beginPath();c.arc(start.x,start.y,s*.19,0,Math.PI*2);c.fill();
    }
    for(const tile of map.buildCells){
      if(state.towers.some(t=>t.col===tile.col&&t.row===tile.row))continue;
      const p=this.toScreen(tile.col,tile.row);
      c.fillStyle='#67e9bb18';c.fillRect(p.x+s*.13,p.y+s*.13,s*.74,s*.74);
      c.strokeStyle='#6cf0c5b5';c.strokeRect(p.x+s*.16,p.y+s*.16,s*.68,s*.68);
    }
    if(state.config.allowed.traps.length)for(const tile of map.trapCells){
      if(state.traps.some(t=>t.col===tile.col&&t.row===tile.row))continue;
      const p=this.toScreen(tile.col+.5,tile.row+.5);
      c.strokeStyle='#ffcc7f5e';c.beginPath();c.arc(p.x,p.y,s*.2,0,Math.PI*2);c.stroke();
    }
    if(map.researchPath.length){
      c.strokeStyle='#a1f4a5';c.lineWidth=2;c.setLineDash([s*.2,s*.24]);c.beginPath();
      map.researchPath.forEach((point,i)=>{const p=this.toScreen(point.col+.5,point.row+.5);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});
      c.stroke();c.setLineDash([]);
    }
    const target=this.toScreen(map.target.x,map.target.y);
    c.shadowColor='#75e7f2';c.shadowBlur=15;c.beginPath();c.arc(target.x,target.y,s*.4,0,2*Math.PI);
    c.fillStyle='#287d92';c.fill();c.strokeStyle='#9df5ff';c.lineWidth=2;c.stroke();
    c.shadowBlur=0;
    c.fillStyle='#d7fdff';c.font='700 '+Math.max(9,s*.22)+'px sans-serif';c.textAlign='center';
    c.fillText('◈',target.x,target.y+s*.08);
    this.health(target.x,target.y-s*.55,s,state.targetHp,state.config.objective.maxHp,'#8cf9e0');
    const selected=state.towers.find(t=>t.id===selectedId)||state.units.find(u=>u.id===selectedId);
    if(selected?.level)this.range(selected.col+.5,selected.row+.5,towerRange(selected));
    if(selected?.to)this.range(selected.x,selected.y,UNITS.drone.range);
    if(selectedCell&&mode==='build'&&TOWERS[selectedType])this.range(selectedCell.col+.5,selectedCell.row+.5,TOWERS[selectedType].range);
    for(const t of state.traps){
      const p=this.toScreen(t.col+.5,t.row+.5);
      c.beginPath();c.arc(p.x,p.y,s*.2,0,2*Math.PI);
      c.fillStyle=t.type==='mine'?'#dfb765':'#92c9f5';c.fill();
      c.fillStyle='#0f2732';c.font='700 '+Math.max(9,s*.2)+'px sans-serif';c.fillText(TRAPS[t.type].icon,p.x,p.y+s*.06);
    }
    for(const t of state.towers){
      const p=this.toScreen(t.col+.5,t.row+.5),def=TOWERS[t.type];
      c.beginPath();c.arc(p.x,p.y,s*.33,0,2*Math.PI);c.fillStyle='#0b2835';c.fill();c.strokeStyle=t.type==='antiAir'?'#98e1fa':'#90f3d1';c.lineWidth=2;c.stroke();
      c.fillStyle='#c1fcf3';c.font='700 '+Math.max(12,s*.39)+'px sans-serif';
      c.fillText(def.icon,p.x,p.y+s*.12);
      c.font='700 '+Math.max(9,s*.15)+'px sans-serif';c.fillText(''+t.level,p.x+s*.29,p.y+s*.27);
    }
    for(const u of state.units){
      if(u.hp<=0)continue;
      const p=this.toScreen(u.x,u.y);c.beginPath();c.arc(p.x,p.y,s*.25,0,2*Math.PI);
      c.fillStyle='#7ef7ec';c.fill();c.strokeStyle='#10303c';c.lineWidth=1.5;c.stroke();
      c.fillStyle='#0b2935';c.font='700 '+Math.max(12,s*.3)+'px sans-serif';c.fillText('◇',p.x,p.y+s*.10);
      this.health(p.x,p.y-s*.36,s*.52,u.hp,u.maxHp,'#8eefe0');
    }
    if(state.team){
      const t=state.team,p=this.toScreen(t.position.x,t.position.y);
      c.beginPath();c.arc(p.x,p.y,s*.34,0,2*Math.PI);c.fillStyle='#d2e49a';c.fill();c.strokeStyle='#fff9ce';c.lineWidth=2;c.stroke();
      c.fillStyle='#18313c';c.font='700 '+Math.max(10,s*.2)+'px sans-serif';c.fillText('SCI',p.x,p.y+s*.06);
      this.health(p.x,p.y-s*.49,s*.9,t.hp,t.maxHp,'#b8f6a8');
    }
    for(const e of state.enemies){
      const p=this.toScreen(e.x,e.y),d=ENEMIES[e.type],r=d.air?s*.24:s*.25;
      c.beginPath();c.ellipse(p.x,p.y,r,r*.8,0,0,2*Math.PI);c.fillStyle=d.color;c.fill();
      c.strokeStyle=d.air?'#dcf9ff':'#4a2732';c.lineWidth=1.5;c.stroke();
      if(d.air){c.beginPath();c.moveTo(p.x-s*.34,p.y-s*.08);c.lineTo(p.x+s*.34,p.y-s*.08);c.strokeStyle='#b4eaff';c.stroke();}
      if(e.type==='shell'){c.strokeStyle='#fff4d3';c.beginPath();c.arc(p.x,p.y,r*.65,0,Math.PI*2);c.stroke();}
      this.health(p.x,p.y-s*.38,s*.6,e.hp,e.maxHp,'#ffc2a2');
    }
    if(!globalThis.document?.documentElement?.classList.contains('reduced-motion'))for(const e of state.effects){
      const from=this.toScreen(e.x,e.y),to=this.toScreen(e.tx,e.ty);
      c.globalAlpha=clamp(e.life/.14,0,1);c.strokeStyle=e.blast?'#ffd997':'#e0ffec';c.lineWidth=2.4;
      c.beginPath();c.moveTo(from.x,from.y);c.lineTo(to.x,to.y);c.stroke();
      if(e.blast){c.beginPath();c.arc(from.x,from.y,s*.4,0,2*Math.PI);c.stroke();}
      c.globalAlpha=1;
    }
    if(selectedCell&&mode==='build'){
      const p=this.toScreen(selectedCell.col,selectedCell.row);
      c.strokeStyle='#fff3a0';c.lineWidth=3;c.strokeRect(p.x+2,p.y+2,s-4,s-4);
    }
    if(paused){
      c.fillStyle='#071b29a6';c.fillRect(0,0,this.width,this.height);
      c.fillStyle='#e4fffa';c.textAlign='center';c.font='700 28px sans-serif';c.fillText('ПАУЗА',this.width/2,this.height/2);
    }
  }
}
