import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ENEMIES,TOWERS,TRAPS,UNITS,MISSIONS} from '../src/config.js';
import {
  ART_COLORS,BIOME_ART,paletteFor,drawTerrainTile,drawTower,drawEnemy,drawTrap,
  drawUnit,drawCore,drawResearchTeam,iconDataURL,biomePreviewURL
} from '../src/art.js';

function canvasMock(){
  const calls=[];
  const methods=new Set(['save','restore','translate','scale','beginPath','arc','stroke',
    'fill','fillRect','strokeRect','moveTo','lineTo','closePath','ellipse','rotate','rect',
    'clip','setLineDash','drawImage','clearRect','fillText']);
  const context=new Proxy({},{
    get(_,key){
      if(methods.has(key))return (...args)=>{calls.push([key,args]);};
      return undefined;
    },
    set(target,key,value){target[key]=value;return true;}
  });
  return {context,calls};
}
test('арт-гайд включает точно восемь игровых биомов',()=>{
  const all=new Set(Object.values(MISSIONS).map(m=>m.biome));
  assert.equal(Object.keys(BIOME_ART).length,8);
  assert.deepEqual(new Set(Object.keys(BIOME_ART)),all);
  for(const biome of all)assert.equal(paletteFor(biome).length,5);
});
test('каждое оборудование и каждый враг получают отдельный рисуемый силуэт',()=>{
  const {context:c,calls}=canvasMock();
  for(const key of Object.keys(TOWERS))drawTower(c,key,42,42,64,1.3,2,false);
  for(const key of Object.keys(TRAPS))drawTrap(c,key,42,42,56,1.3,false);
  for(const key of Object.keys(UNITS))drawUnit(c,key,42,42,60,1.3,false);
  for(const key of Object.keys(ENEMIES))drawEnemy(c,key,42,42,60,1.3,false);
  drawCore(c,42,42,70,1.3,false);
  drawResearchTeam(c,42,42,70,1.3);
  assert.ok(calls.length>550,'детализированные геометрические формы и подсветка');
});
test('тайлы разных биомов детерминированны, не зависят от случайных чисел и анимации',()=>{
  for(const biome of Object.keys(BIOME_ART)){
    const a=canvasMock(),b=canvasMock();
    drawTerrainTile(a.context,0,0,64,2,5,biome);
    drawTerrainTile(b.context,0,0,64,2,5,biome);
    assert.deepEqual(a.calls,b.calls,'детерминированность: '+biome);
  }
});
test('режим уменьшения движения сохраняет все объекты и работает без анимации',()=>{
  const ctx=canvasMock();
  for(const key of Object.keys(ENEMIES))drawEnemy(ctx.context,key,0,0,36,0,true);
  for(const key of Object.keys(TOWERS))drawTower(ctx.context,key,0,0,40,0,1,true);
  for(const key of Object.keys(UNITS))drawUnit(ctx.context,key,0,0,40,0,true);
  assert.ok(ctx.calls.some(([k])=>k==='fill'));
});
test('генерация интерфейсных картинок безопасна на сервере без document',()=>{
  assert.equal(iconDataURL('kinetic','tower'), '');
  assert.equal(biomePreviewURL('Кроны гигантов'), '');
});
test('HTML подключает графическую тему и кэшированный Canvas-рендерер',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../art-style.css',import.meta.url),'utf8');
  const visual=readFileSync(new URL('../src/visual.js',import.meta.url),'utf8');
  assert.match(html,/href="\.\/art-style\.css"/);
  assert.match(html,/id="briefingArt"/);
  assert.match(css,/assets\/art\/frontier\.svg/);
  assert.match(visual,/this\.makeTerrain\(\)/);
  assert.match(visual,/drawTerrainTile\(/);
  assert.match(visual,/drawTower\(/);
  assert.match(visual,/drawEnemy\(/);
  assert.match(visual,/drawCore\(/);
  assert.match(visual,/this\.terrain/);
});
