// Data-driven content of the six-sector MVP. Distances are in map cells; times in simulation seconds.
export const CELL = 64;
export const ENEMIES = {
  skitter:{name:'Искрошмыг',hp:55,speed:1.2,air:false,kinetic:0,damage:10,reward:10,color:'#ed967b'},
  shell:{name:'Кремнепанцирь',hp:230,speed:.55,air:false,kinetic:.30,damage:17,reward:22,color:'#dba788'},
  runner:{name:'Рывун',hp:75,speed:2,air:false,kinetic:0,damage:9,reward:15,color:'#ffcb74'},
  flyer:{name:'Парокрыл',hp:80,speed:1.6,air:true,kinetic:0,damage:12,reward:16,color:'#9fd8ed'}
};
export const TOWERS = {
  kinetic:{name:'Кинетическая',short:'Кинетическая турель',cost:[100,80,125],damage:12,rate:1.25,range:3,kind:'kinetic',targets:'ground',icon:'⌖'},
  pulse:{name:'Импульсная',short:'Импульсный излучатель',cost:[160,115,170],damage:32,rate:.55,range:2.7,kind:'energy',piercing:.4,targets:'ground',icon:'ϟ'},
  mortar:{name:'Гаубица',short:'Гаубица «Гром»',cost:[220,150,210],damage:24,rate:.4,range:4,minRange:1.5,splash:1.2,kind:'explosive',targets:'ground',icon:'✹'},
  antiAir:{name:'Зенитная',short:'Зенитный пост',cost:[135,95,140],damage:9,rate:2,range:3.5,kind:'kinetic',targets:'air',icon:'⌁'}
};
export const TRAPS = {
  mine:{name:'Электромина',cost:55,icon:'✴',charges:1,damage:55,radius:.85},
  slow:{name:'Замедляющее поле',cost:80,icon:'◌',charges:2,slow:.4,duration:4}
};
export const UNITS = {
  drone:{name:'Разведдрон',cost:130,icon:'◇',maxHp:90,speed:3.2,damage:14,rate:1.2,range:2.8,limit:2}
};
export const RESEARCH = {
  precision:{name:'Точный привод I',desc:'+10% урона кинетических турелей',materials:250,data:0,after:1},
  capacitor:{name:'Энергетический конденсатор',desc:'+15% урона импульсных башен',materials:280,data:30,after:2},
  logistics:{name:'Полевое снабжение',desc:'+100 стартовой ЭС в каждой вылазке',materials:400,data:50,after:3}
};
const path=(corners)=>{
  const out=[];
  for(let i=0;i<corners.length-1;i++){
    const [x,y]=corners[i],[a,b]=corners[i+1];
    if(x!==a&&y!==b)throw Error('Route must be orthogonal');
    const n=Math.abs(a-x)+Math.abs(b-y),dx=Math.sign(a-x),dy=Math.sign(b-y);
    for(let j=i===0?0:1;j<=n;j++)out.push({col:x+dx*j,row:y+dy*j});
  }
  return out;
};
export const center=cell=>({x:cell.col+.5,y:cell.row+.5});
export const cellKey=(col,row)=>col+':'+row;
const w=(count,interval,type='skitter',route='west',delay=0)=>({type,route,count,interval,delay});
function makeMap(width,height,corners,other={},researchPath=[]){
  const routes={west:path(corners)};
  for(const [id,points] of Object.entries(other)) routes[id]=path(points);
  const road=new Set(Object.values(routes).flatMap(r=>r.map(c=>cellKey(c.col,c.row))));
  const occupiedByResearchers=new Set();
  for(let i=0;i<researchPath.length-1;i++){
    const [a,b]=[researchPath[i],researchPath[i+1]],steps=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]))*4||1;
    for(let j=0;j<=steps;j++){
      const ratio=j/steps,col=Math.round(a[0]+(b[0]-a[0])*ratio),row=Math.round(a[1]+(b[1]-a[1])*ratio);
      occupiedByResearchers.add(cellKey(col,row));
    }
  }
  for(const [col,row] of researchPath)occupiedByResearchers.add(cellKey(col,row));
  const build=[];
  for(let row=1;row<height-1;row++)for(let col=1;col<width-1;col++){
    if(road.has(cellKey(col,row))||occupiedByResearchers.has(cellKey(col,row)))continue;
    const near=Object.values(routes).some(r=>r.some(c=>Math.abs(c.col-col)+Math.abs(c.row-row)<=2));
    if(near && (col+row)%5!==0)build.push({col,row});
  }
  const trapCells=[...new Map(Object.values(routes).flatMap(r=>r.slice(2,-3)).map(c=>[cellKey(c.col,c.row),c])).values()];
  return {width,height,routes,buildCells:build,trapCells,researchPath:researchPath.map(([col,row])=>({col,row})),
    target:center(routes.west.at(-1))};
}
const missions=[
  {
    id:'sector-01',number:1,name:'Первая линия',biome:'Посадочная долина',
    summary:'Инженеры устанавливают первый энергетический купол. Защитите генератор.',
    objective:{type:'defend',duration:80,maxHp:200},
    map:makeMap(20,12,[[0,5],[4,5],[4,3],[9,3],[9,7],[14,7],[14,5],[18,5]]),
    startSupply:400,waveBonus:100,
    allowed:{towers:['kinetic'],traps:[],units:[]},
    waves:[{groups:[w(5,2)]},{groups:[w(8,1.6)]},{groups:[w(12,1.2)]}],
    stars:['Победить и завершить монтаж','Сохранить ≥ 60% HP генератора','Не допустить повреждения генератора'],
    rewards:{materials:180,data:20,firstMaterials:320,firstData:30},
    briefing:[
      ['Новая почва','«Ковчег» достиг поверхности Нова-7. Колонисты разворачивают первую энергетическую сеть.'],
      ['Неожиданная реакция','Мелкие стайные существа тянутся к теплу и вибрации генератора. Контакт может повредить оборудование.'],
      ['Ваша задача','Установите оборону вдоль коридора доступа. Защитите генератор до окончания монтажа.'],
      ['План защиты','Используйте кинетические турели. Удержав генератор без повреждений, получите три звезды.']
    ]
  },
  {
    id:'sector-02',number:2,name:'Геологический пост',biome:'Посадочная долина',
    summary:'Геосканер привлёк бронированных животных. Энергетические выстрелы пробивают панцирь.',
    objective:{type:'defend',duration:90,maxHp:220},
    map:makeMap(20,12,[[0,6],[4,6],[4,2],[11,2],[11,8],[16,8],[16,5],[19,5]]),
    startSupply:550,waveBonus:130,
    allowed:{towers:['kinetic','pulse'],traps:[],units:[]},
    waves:[{groups:[w(8,1.3)]},{groups:[w(3,3,'shell'),w(5,1.6,'skitter','west',4)]},{groups:[w(5,2.5,'shell'),w(6,1.25)]}],
    stars:['Завершить геосканирование','Сохранить ≥ 60% HP геосканера','Не допустить повреждения геосканера'],
    rewards:{materials:210,data:25,firstMaterials:370,firstData:40},
    briefing:[
      ['Минеральный след','Геологи обнаружили необычные кристаллические отложения. Геосканер должен работать под защитой.'],
      ['Кремнепанцирь','У нового вида прочная внешняя броня. Кинетическое оружие теряет эффективность.'],
      ['Новая технология','Инженеры выдали импульсный излучатель: энергетические импульсы обходят кинетическую броню.'],
      ['Приказ','Сохраните геосканер, завершите исследование и задержите все три волны.']
    ]
  },
  {
    id:'sector-03',number:3,name:'Сигнал за холмом',biome:'Посадочная долина',
    summary:'Задержите агрессивные стаи, пока учёные считывают данные с удалённого маяка.',
    objective:{type:'hold',duration:85,maxHp:220,holdRadius:1.8},
    map:makeMap(21,12,[[0,7],[5,7],[5,3],[11,3],[11,8],[16,8],[16,5],[20,5]]),
    startSupply:610,waveBonus:135,
    allowed:{towers:['kinetic','pulse'],traps:['mine','slow'],units:['drone']},
    waves:[{groups:[w(7,1.3,'runner')]},{groups:[w(8,1.5),w(3,2.5,'runner','west',5)]},{groups:[w(5,2.4,'shell'),w(7,1.1,'runner','west',4)]},{groups:[w(8,1.2,'runner'),w(5,1.8,'skitter','west',4)]}],
    stars:['Завершить запись данных','Сохранить ≥ 60% HP маяка','Не допустить повреждения маяка'],
    rewards:{materials:240,data:30,firstMaterials:450,firstData:50},
    briefing:[
      ['Дальний сигнал','Маяк за холмом регистрирует движение неизвестных быстрых существ.'],
      ['Условия работы','Учёные должны собрать 85 секунд данных. Если животные приблизятся к маяку, сканирование остановится.'],
      ['Полевое снаряжение','Теперь доступны электромины, замедляющие поля и разведдроны. Дрон можно перемещать на любую позицию.'],
      ['Приказ','Удерживайте область у маяка чистой от врагов, чтобы прибор завершил измерения.']
    ]
  },
  {
    id:'sector-04',number:4,name:'Каменный коридор',biome:'Кремниевые ущелья',
    summary:'Сопроводите специалистов до места монтажа под атаками с двух направлений.',
    objective:{type:'remote',duration:55,maxHp:240,groupHp:160,teamSpeed:.95},
    map:makeMap(22,13,[[0,6],[6,6],[6,3],[13,3],[13,8],[17,8],[17,6],[21,6]],
       {north:[[10,0],[10,3],[13,3],[13,8],[17,8],[17,6],[21,6]]},
       [[1,10],[7,10],[7,9],[15,9],[17,6]]),
    startSupply:750,waveBonus:160,
    allowed:{towers:['kinetic','pulse','mortar'],traps:['mine','slow'],units:['drone']},
    waves:[{groups:[w(8,1.2),w(5,1.8,'runner','north',4)]},{groups:[w(5,2,'shell'),w(8,1.1,'skitter','north',3)]},{groups:[w(8,1.1,'runner'),w(4,2.5,'shell','north',2)]},{groups:[w(10,1.1),w(5,2.5,'shell','north',4)]}],
    stars:['Доставить группу и завершить монтаж','Сохранить ≥ 50% HP исследовательской группы','Не допустить повреждения исследовательской группы'],
    rewards:{materials:270,data:35,firstMaterials:490,firstData:60},
    briefing:[
      ['Второй вход','В кремниевых ущельях обнаружен обходной проход. Стаи атакуют с запада и с севера.'],
      ['Доставка прибора','Научная группа выдвинется по отмеченному маршруту к точке установки и запустит монтаж.'],
      ['Огневая поддержка','Теперь доступна гаубица «Гром», поражающая сразу несколько наземных целей.'],
      ['Приказ','Оберегайте подвижную группу и защищайте установку до завершения монтажа.']
    ]
  },
  {
    id:'sector-05',number:5,name:'Небесная тень',biome:'Кремниевые ущелья',
    summary:'Новая воздушная фауна атакует станцию наблюдения. Разверните зенитные посты.',
    objective:{type:'hold',duration:110,maxHp:260,holdRadius:1.7},
    map:makeMap(22,13,[[0,7],[5,7],[5,3],[13,3],[13,9],[18,9],[18,6],[21,6]],
       {air:[[0,2],[7,2],[7,5],[15,5],[15,6],[21,6]]}),
    startSupply:850,waveBonus:190,
    allowed:{towers:['kinetic','pulse','mortar','antiAir'],traps:['mine','slow'],units:['drone']},
    waves:[{groups:[w(7,1.5),w(6,1.6,'flyer','air',2)]},{groups:[w(8,1.3,'flyer','air'),w(5,2.3,'shell','west',3)]},{groups:[w(10,1.0,'flyer','air'),w(9,1.3,'runner','west',2)]},{groups:[w(8,1.1,'flyer','air'),w(6,2.2,'shell','west',5)]}],
    stars:['Завершить наблюдение','Сохранить ≥ 60% HP станции','Не допустить повреждения станции'],
    rewards:{materials:290,data:40,firstMaterials:520,firstData:65},
    briefing:[
      ['Небо оживает','Станция наблюдения фиксирует воздушные стаи, летящие напрямую к источнику света.'],
      ['Парокрыл','Летающие противники игнорируют наземные препятствия; их нельзя остановить обычными башнями.'],
      ['Зенитная технология','Зенитные посты автоматически разблокированы до этой миссии. Направьте их вдоль голубого воздушного маршрута.'],
      ['Приказ','Защитите станцию от атак с земли и с воздуха до окончания измерений.']
    ]
  },
  {
    id:'sector-06',number:6,name:'Путь образцов',biome:'Кремниевые ущелья',
    summary:'Исследовательская группа несёт образцы к точке эвакуации. Обеспечьте сопровождение.',
    objective:{type:'escort',duration:0,maxHp:220,groupHp:200,teamSpeed:.9,stopSeconds:12,stops:[2,4]},
    map:makeMap(24,14,[[0,6],[4,6],[4,3],[10,3],[10,9],[17,9],[17,6],[23,6]],
       {north:[[12,0],[12,9],[17,9],[17,6],[23,6]],air:[[0,1],[9,1],[9,6],[23,6]]},
       [[1,11],[7,11],[10,10],[15,10],[19,10],[22,8]]),
    startSupply:1000,waveBonus:200,
    allowed:{towers:['kinetic','pulse','mortar','antiAir'],traps:['mine','slow'],units:['drone']},
    waves:[{groups:[w(8,1.2),w(5,1.8,'runner','north',3)]},
      {groups:[w(5,2.4,'shell'),w(6,1.5,'flyer','air',3)]},
      {groups:[w(8,1.0,'runner'),w(6,1.8,'skitter','north',3)]},
      {groups:[w(8,1.3,'flyer','air'),w(5,2.6,'shell','west',2)]},
      {groups:[w(10,1.0),w(7,1.4,'runner','north',3),w(5,1.7,'flyer','air',7)]}],
    stars:['Эвакуировать исследователей и отразить атаки','Сохранить ≥ 50% HP исследовательской группы','Не потерять ни одного развёрнутого дрона'],
    rewards:{materials:300,data:40,firstMaterials:550,firstData:70},
    briefing:[
      ['Последние образцы','Лаборатория получила редкие геологические образцы. Их нужно доставить к точке эвакуации.'],
      ['Мобильная группа','Исследователи идут по зелёной линии и делают остановки для сбора данных. Их здоровье является критическим.'],
      ['Три направления','Нападения ожидаются с запада, с севера и с воздуха. Заранее распределите турели и перемещайте дроны.'],
      ['Приказ','Сопроводите группу до эвакуации и защитите её от оставшихся волн. Это конец доступной главы MVP.']
    ]
  }
];
// Keep the first sector's carefully authored 18 building slots from its design specification.
missions[0].map.buildCells=[
  [1,3],[2,4],[3,6],[5,6],[6,4],[7,2],[7,5],[8,6],[10,2],
  [10,6],[11,8],[12,5],[13,6],[15,6],[16,4],[17,3],[18,7],[5,2]
].map(([col,row])=>({col,row}));
export const MISSIONS=Object.fromEntries(missions.map(m=>[m.id,m]));
export const MISSION_IDS=missions.map(m=>m.id);
export const sectorId=n=>'sector-'+String(n).padStart(2,'0');
export const preceding=id=>MISSION_IDS.indexOf(id)===0?null:MISSION_IDS[MISSION_IDS.indexOf(id)-1]??null;
export function validateContent(){
  if(MISSION_IDS.length!==6)throw Error('Expected exactly six MVP sectors');
  for(const mission of missions){
    const {width,height,routes,buildCells,trapCells}=mission.map;
    if(mission.stars.length!==3 || mission.briefing.length<3 || !mission.waves.length)throw Error('Incomplete sector '+mission.id);
    for(const route of Object.values(routes)){
      if(route.length<2)throw Error('Short route '+mission.id);
      for(const c of route)if(c.col<0||c.row<0||c.col>=width||c.row>=height)throw Error('Out of bounds route '+mission.id);
    }
    const road=new Set(Object.values(routes).flatMap(r=>r.map(c=>cellKey(c.col,c.row))));
    for(const c of buildCells)if(road.has(cellKey(c.col,c.row)))throw Error('Blocked road '+mission.id);
    if(!trapCells.length||!buildCells.length)throw Error('Missing build or trap zones '+mission.id);
    for(const wave of mission.waves)for(const g of wave.groups) {
      if(!ENEMIES[g.type] || !routes[g.route] || g.count<=0 || g.interval<=0 || g.delay<0)throw Error('Invalid wave '+mission.id);
    }
    for(const t of mission.allowed.towers)if(!TOWERS[t])throw Error('Invalid tower '+t);
  }
  return true;
}
validateContent();
