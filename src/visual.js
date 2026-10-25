import { GRID, ROUTE, GENERATOR, SPAWN, BUILD_CELLS, CELL, TURRET, ENEMY, center } from './config.js';
import { enemyPosition, towerRange } from './model.js';

function clamp(x,min,max){ return Math.max(min,Math.min(max,x)); }
export class Battlefield {
  constructor(canvas,onPick) {
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d');
    this.onPick=onPick;
    this.width=0;this.height=0;this.dpr=1;
    this.scale=42;this.camX=GRID.width/2;this.camY=GRID.height/2;
    this.initialized=false;this.pointer=null;
    this._setupInput();
    this.observer=new ResizeObserver(()=>this.resize());
    this.observer.observe(canvas.parentElement);
  }
  resize() {
    const rect=this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.width=rect.width;this.height=rect.height;
    this.dpr=Math.min(window.devicePixelRatio || 1,2);
    this.canvas.width=Math.round(this.width*this.dpr);
    this.canvas.height=Math.round(this.height*this.dpr);
    if (!this.initialized) {
      this.scale=clamp(Math.min(this.width/GRID.width,this.height/GRID.height),25,74);
      this.initialized=true;
    }
    this.clampCamera();
  }
  clampCamera() {
    const halfW=this.width/(2*this.scale),halfH=this.height/(2*this.scale);
    this.camX=halfW>=GRID.width/2? GRID.width/2 : clamp(this.camX,halfW,GRID.width-halfW);
    this.camY=halfH>=GRID.height/2? GRID.height/2 : clamp(this.camY,halfH,GRID.height-halfH);
  }
  toScreen(x,y) {
    return {x:this.width/2+(x-this.camX)*this.scale,y:this.height/2+(y-this.camY)*this.scale};
  }
  toWorld(x,y) {
    return {x:this.camX+(x-this.width/2)/this.scale,y:this.camY+(y-this.height/2)/this.scale};
  }
  changeZoom(factor,focusX=this.width/2,focusY=this.height/2) {
    const before=this.toWorld(focusX,focusY);
    this.scale=clamp(this.scale*factor,20,120);
    const after=this.toWorld(focusX,focusY);
    this.camX+=before.x-after.x;this.camY+=before.y-after.y;
    this.clampCamera();
  }
  _setupInput() {
    const canvas=this.canvas;
    canvas.addEventListener('pointerdown',event=>{
      if (event.button!==0) return;
      const r=canvas.getBoundingClientRect();
      const x=event.clientX-r.left,y=event.clientY-r.top;
      this.pointer={id:event.pointerId,startX:x,startY:y,camX:this.camX,camY:this.camY,moved:false};
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove',event=>{
      const p=this.pointer;
      if (!p || event.pointerId!==p.id) return;
      const r=canvas.getBoundingClientRect();
      const x=event.clientX-r.left,y=event.clientY-r.top;
      if (Math.hypot(x-p.startX,y-p.startY)>7) p.moved=true;
      if (p.moved) {
        this.camX=p.camX-(x-p.startX)/this.scale;
        this.camY=p.camY-(y-p.startY)/this.scale;
        this.clampCamera();
      }
    });
    canvas.addEventListener('pointerup',event=>{
      const p=this.pointer;
      if (!p || event.pointerId!==p.id) return;
      if (!p.moved) {
        const r=canvas.getBoundingClientRect();
        const world=this.toWorld(event.clientX-r.left,event.clientY-r.top);
        this.onPick(Math.floor(world.x),Math.floor(world.y));
      }
      this.pointer=null;
    });
    canvas.addEventListener('pointercancel',()=>{this.pointer=null;});
    canvas.addEventListener('wheel',event=>{
      event.preventDefault();
      const r=canvas.getBoundingClientRect();
      this.changeZoom(event.deltaY<0?1.10:1/1.10,event.clientX-r.left,event.clientY-r.top);
    },{passive:false});
    canvas.addEventListener('contextmenu',event=>event.preventDefault());
  }
  render(state,{selectedCell=null,selectedTowerId=null,mode='build',paused=false}={}) {
    if (!this.width || !this.height || !this.ctx) return;
    const ctx=this.ctx;
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    ctx.clearRect(0,0,this.width,this.height);
    const back=ctx.createLinearGradient(0,0,0,this.height);
    back.addColorStop(0,'#0c2a3a');back.addColorStop(1,'#091e2b');
    ctx.fillStyle=back;ctx.fillRect(0,0,this.width,this.height);
    // Неподвижный декор мира. Всё в координатах сетки, не в пикселях устройства.
    const s=this.scale;
    const a=this.toScreen(0,0);
    ctx.fillStyle='#183f3e';
    ctx.fillRect(a.x,a.y,GRID.width*s,GRID.height*s);
    for (let row=0;row<GRID.height;row++) for(let col=0;col<GRID.width;col++) {
      const p=this.toScreen(col,row);
      if(p.x+s<0 || p.x>this.width || p.y+s<0 || p.y>this.height) continue;
      const noise=(col*41+row*67+col*row*17)%11;
      ctx.fillStyle=noise<4?'#1a4141':noise<8?'#1a3b3d':'#1e4844';
      ctx.fillRect(p.x+1,p.y+1,s-2,s-2);
      if(noise===1){ctx.fillStyle='#82a9721f';ctx.beginPath();ctx.arc(p.x+s*.4,p.y+s*.7,s*.15,0,2*Math.PI);ctx.fill();}
      ctx.strokeStyle='#7ed9c010';ctx.lineWidth=1;ctx.strokeRect(p.x+.5,p.y+.5,s,s);
    }
    // Тропа: фиксированный маршрут, не зависимый от разрешения.
    for(const cell of ROUTE) {
      const p=this.toScreen(cell.col,cell.row);
      ctx.fillStyle='#315a5d';ctx.fillRect(p.x+1,p.y+1,s-2,s-2);
      ctx.strokeStyle='#6fb6aa55';ctx.lineWidth=Math.max(1,s*.03);ctx.strokeRect(p.x+2,p.y+2,s-4,s-4);
    }
    ctx.strokeStyle='#9bd7c46f';ctx.lineWidth=Math.max(1.5,s*.045);ctx.setLineDash([s*.24,s*.24]);
    ctx.beginPath();
    ROUTE.forEach((c,i)=>{const p=this.toScreen(c.col+.5,c.row+.5);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});
    ctx.stroke();ctx.setLineDash([]);
    for(const cell of BUILD_CELLS) {
      const p=this.toScreen(cell.col,cell.row);
      const occupied=state?.towers.some(t=>t.col===cell.col&&t.row===cell.row);
      if(occupied)continue;
      ctx.fillStyle='#4fe0c119';ctx.fillRect(p.x+s*.12,p.y+s*.12,s*.76,s*.76);
      ctx.strokeStyle='#71ebcfaa';ctx.lineWidth=1.5;ctx.strokeRect(p.x+s*.14,p.y+s*.14,s*.72,s*.72);
      const c=this.toScreen(cell.col+.5,cell.row+.5);
      ctx.strokeStyle='#a4f3e399';ctx.beginPath();ctx.moveTo(c.x-s*.12,c.y);ctx.lineTo(c.x+s*.12,c.y);
      ctx.moveTo(c.x,c.y-s*.12);ctx.lineTo(c.x,c.y+s*.12);ctx.stroke();
    }
    // Точка появления.
    const sp=this.toScreen(SPAWN.col+.5,SPAWN.row+.5);
    ctx.fillStyle='#d49c7d';ctx.beginPath();ctx.arc(sp.x,sp.y,s*.26,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='700 '+Math.max(9,s*.2)+'px sans-serif';ctx.textAlign='center';ctx.fillText('!',sp.x,sp.y+s*.07);
    // Генератор.
    const gp=this.toScreen(GENERATOR.col+.5,GENERATOR.row+.5);
    ctx.shadowColor='#79eaf4';ctx.shadowBlur=16;
    ctx.fillStyle='#32778b';ctx.strokeStyle='#a0faff';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(gp.x,gp.y,s*.43,0,2*Math.PI);ctx.fill();ctx.stroke();
    ctx.fillStyle='#9deeff';ctx.beginPath();ctx.arc(gp.x,gp.y,s*.22,0,2*Math.PI);ctx.fill();
    ctx.shadowBlur=0;
    this._healthBar(gp.x,gp.y-s*.62,s*.96,state?.targetHp??GENERATOR.maxHp,GENERATOR.maxHp,'#63efd4');
    ctx.textAlign='center';ctx.fillStyle='#d7faff';ctx.font='700 '+Math.max(9,s*.18)+'px sans-serif';ctx.fillText('БАЗА',gp.x,gp.y+s*.66);
    // Подсветка выбранной башни и её дистанции.
    const selectedTower=state?.towers.find(t=>t.id===selectedTowerId);
    if (selectedTower) this._range(selectedTower.col+.5,selectedTower.row+.5,towerRange(selectedTower),'#72f2d6');
    if(selectedCell && mode==='build') this._range(selectedCell.col+.5,selectedCell.row+.5,TURRET.range,'#90d5ea');
    for(const tower of state?.towers||[]) {
      const p=this.toScreen(tower.col+.5,tower.row+.5);
      ctx.fillStyle='#0c2b36';ctx.strokeStyle='#7ff4d0';ctx.lineWidth=Math.max(1.5,s*.045);
      ctx.beginPath();ctx.arc(p.x,p.y,s*.34,0,2*Math.PI);ctx.fill();ctx.stroke();
      ctx.fillStyle='#66cdbb';ctx.fillRect(p.x-s*.09,p.y-s*.28,s*.18,s*.34);
      ctx.fillStyle='#c1fff0';ctx.beginPath();ctx.arc(p.x,p.y,s*.13,0,2*Math.PI);ctx.fill();
      ctx.font='700 '+Math.max(8,s*.16)+'px sans-serif';ctx.textAlign='center';ctx.fillStyle='#ddfff8';ctx.fillText(''+tower.level,p.x,p.y+s*.26);
    }
    // Противники и полосы HP.
    for(const enemy of state?.enemies||[]) {
      const ep=enemyPosition(enemy),p=this.toScreen(ep.x,ep.y);
      ctx.fillStyle='#9b4e63';ctx.strokeStyle='#ffc2a5';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.ellipse(p.x,p.y,s*.27,s*.20,-.2,0,2*Math.PI);ctx.fill();ctx.stroke();
      ctx.fillStyle='#f4bf9b';ctx.beginPath();ctx.arc(p.x+s*.1,p.y-s*.07,s*.09,0,2*Math.PI);ctx.fill();
      this._healthBar(p.x,p.y-s*.32,s*.58,enemy.hp,enemy.maxHp,'#ff9a86');
    }
    for(const shot of state?.shots||[]) {
      const from=this.toScreen(shot.x,shot.y),to=this.toScreen(shot.target.x,shot.target.y);
      ctx.globalAlpha=clamp(shot.life/.16,0,1);
      ctx.strokeStyle='#afffea';ctx.lineWidth=Math.max(2,s*.05);
      ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();ctx.globalAlpha=1;
    }
    if(selectedCell && mode==='build'){
      const p=this.toScreen(selectedCell.col,selectedCell.row);
      ctx.strokeStyle='#f2eb98';ctx.lineWidth=3;ctx.strokeRect(p.x+2,p.y+2,s-4,s-4);
    }
    if(paused){
      ctx.fillStyle='#0617247a';ctx.fillRect(0,0,this.width,this.height);
      ctx.fillStyle='#eafff9';ctx.font='700 27px Rajdhani, sans-serif';ctx.textAlign='center';
      ctx.fillText('ПАУЗА',this.width/2,this.height/2);
    }
  }
  _range(x,y,r,color){
    const p=this.toScreen(x,y),ctx=this.ctx;
    ctx.fillStyle='#4be4c40f';ctx.strokeStyle=color;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(p.x,p.y,r*this.scale,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  _healthBar(x,y,width,value,max,color){
    const ctx=this.ctx,h=4;
    ctx.fillStyle='#061a1f';ctx.fillRect(x-width/2,y,width,h);
    ctx.fillStyle=color;ctx.fillRect(x-width/2,y,width*clamp(value/max,0,1),h);
  }
}
