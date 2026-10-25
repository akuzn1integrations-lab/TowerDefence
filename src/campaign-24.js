// Campaign chapters 2–4. This file is pure content: config.js supplies the map builder.
// Each sector has its own briefing, objectives, wave script and enemy combination.
const g=(type,count,interval=1.5,route='west',delay=0)=>({type,count,interval,route,delay});
const ROUTE_PATTERNS=[
 [[0,7],[4,7],[4,3],[10,3],[10,9],[16,9],[16,7],[22,7]],
 [[0,5],[6,5],[6,10],[12,10],[12,4],[18,4],[18,7],[22,7]],
 [[0,8],[3,8],[3,2],[12,2],[12,9],[19,9],[19,7],[22,7]],
 [[0,4],[7,4],[7,8],[15,8],[15,3],[20,3],[20,7],[22,7]],
 [[0,6],[4,6],[4,10],[11,10],[11,4],[17,4],[17,7],[22,7]],
 [[0,7],[7,7],[7,3],[13,3],[13,11],[19,11],[19,7],[22,7]]
];
const NORTH=[
 [ [8,0],[8,3],[10,3],[10,9],[16,9],[16,7],[22,7] ],
 [ [12,0],[12,4],[18,4],[18,7],[22,7] ],
 [ [9,0],[9,2],[12,2],[12,9],[19,9],[19,7],[22,7] ],
 [ [15,0],[15,3],[20,3],[20,7],[22,7] ],
 [ [11,0],[11,4],[17,4],[17,7],[22,7] ],
 [ [13,0],[13,3],[13,11],[19,11],[19,7],[22,7] ]
];
const AIR=[[0,1],[8,1],[8,6],[18,6],[18,7],[22,7]];
const RESEARCH_PATH=[[1,12],[5,12],[9,12],[13,12],[18,12],[22,10]];
const short={
  defend:'Прибор должен работать до окончания исследования.',
  hold:'При приближении зверей к станции сбор данных останавливается.',
  relay:'По очереди активируйте три ретранслятора, очищая прилегающие зоны.',
  remote:'Защитите исследователей по пути доставки и во время монтажа.',
  escort:'Сопроводите исследовательскую группу с промежуточными остановками.'
};
export const EXPANSION_ENEMIES={
  spore:{name:'Споронос',hp:115,speed:1.0,air:false,kinetic:.12,damage:13,reward:18,color:'#b7dc9d'},
  leader:{name:'Сигнальный вожак',hp:240,speed:.85,air:false,kinetic:.12,damage:17,reward:32,color:'#e8a5dc',aura:2.8,auraSpeed:.15},
  glider:{name:'Крылатый охотник',hp:145,speed:1.8,air:true,kinetic:.15,damage:14,reward:25,color:'#93d7fc'},
  crawler:{name:'Разломник',hp:430,speed:.64,air:false,kinetic:.38,damage:23,reward:48,color:'#bcb3e9'},
  stalker:{name:'Тенеслед',hp:145,speed:2.15,air:false,kinetic:.1,damage:16,reward:23,color:'#faadbd'},
  titan:{name:'Глубинный титант',hp:1400,speed:.38,air:false,kinetic:.28,damage:35,reward:170,color:'#dfad80',boss:true},
  monarch:{name:'Матриарх разлома',hp:2050,speed:.42,air:false,kinetic:.25,damage:40,reward:240,color:'#f0aabf',boss:true}
};
export const EXPANSION_TOWERS={
  cryo:{name:'Крио-маяк',short:'Крио-маяк',cost:[185,130,185],damage:5,rate:1.0,range:3.0,kind:'energy',targets:'ground',slow:.35,slowDuration:2.2,icon:'❄'},
  sonic:{name:'Резонатор',short:'Резонансная установка',cost:[245,165,225],damage:21,rate:.78,range:3.4,kind:'energy',targets:'both',splash:.8,icon:'◉'}
};
export const EXPANSION_TRAPS={
  lure:{name:'Акустическая приманка',cost:105,icon:'♫',charges:3,slow:.75,duration:3.8}
};
export const EXPANSION_UNITS={
  infantry:{name:'Экзопехота',cost:210,icon:'⬡',maxHp:210,speed:1.8,damage:28,rate:.8,range:2.4,limit:2,targets:'ground'},
  repair:{name:'Ремонтный бот',cost:195,icon:'✚',maxHp:120,speed:2.25,damage:0,rate:1,range:2.6,limit:1,repairPerSecond:3}
};
export const EXPANSION_RESEARCH={
  cooling:{name:'Криогенные контуры',desc:'+15% продолжительности замедления крио-маяка',materials:620,data:90,after:7},
  droneArmor:{name:'Броня мобильных групп',desc:'+35% здоровья мобильных отрядов',materials:800,data:120,after:10},
  resonance:{name:'Настройка резонатора',desc:'+15% урона резонансной установки',materials:1050,data:150,after:13},
  medtech:{name:'Безопасный транспорт',desc:'+25% здоровья исследовательской группы',materials:1300,data:200,after:16},
  survival:{name:'Полевое усиление',desc:'+250 стартовой энергии снабжения',materials:1650,data:230,after:19},
  lastStand:{name:'Финальный периметр',desc:'+15% урона всех башен',materials:2200,data:290,after:22}
};
const SECTORS=[
  {n:7,name:'Огни трясины',biome:'Светящиеся болота',mode:'hold',pattern:0,
   story:'Экспедиция находит светящиеся гнёзда, реагирующие на движение техники.',focus:'споровые стаи',newTech:'крио-маяк',
   waves:[[g('spore',9),g('runner',5,1.4,'west',3)],[g('shell',5,2.3),g('spore',8,1.4,'north',3)],[g('leader',2,3),g('spore',10,1.2,'west',4)],[g('spore',14,1.0),g('runner',8,1.2,'north',5)]]},
  {n:8,name:'Пульс под водой',biome:'Светящиеся болота',mode:'relay',pattern:1,
   story:'Три датчика фиксируют синхронную пульсацию под болотом.',focus:'быстрые налёты на станции',newTech:'цепь ретрансляторов',
   waves:[[g('spore',10,1.3),g('runner',6,1.4,'north',3)],[g('leader',3,3.2),g('shell',6,2.1,'west',4)],[g('flyer',9,1.4,'air'),g('spore',12,1.1,'north',5)],[g('stalker',9,1.4),g('leader',3,3,'north',6)]]},
  {n:9,name:'Отступающий свет',biome:'Светящиеся болота',mode:'escort',pattern:2,
   story:'Образцы биолюминесцентных водорослей нужно вынести до прилива.',focus:'наземные и воздушные стаи',newTech:'переносная лаборатория',
   waves:[[g('runner',10,1.1),g('glider',6,1.5,'air',2)],[g('spore',11),g('shell',5,2.2,'north',5)],[g('leader',3,3),g('stalker',8,1.3,'north',2)],[g('glider',10,1.25,'air'),g('spore',11,1.2,'west',3)],[g('shell',6,2.1),g('runner',12,1.0,'north',3)]]},
  {n:10,name:'Первый разлом',biome:'Тектонический разлом',mode:'defend',pattern:3,
   story:'Сейсмический пост раскрывает коридор миграции под плато.',focus:'панцирные мигранты',newTech:'экзопехота',
   waves:[[g('crawler',4,3.2),g('runner',8,1.0,'north',3)],[g('shell',8,2),g('leader',2,3,'west',4)],[g('crawler',5,3),g('spore',10,1.4,'north',5)],[g('stalker',10,1.3),g('crawler',5,3,'north',4)]]},
  {n:11,name:'Зов в пустоте',biome:'Тектонический разлом',mode:'remote',pattern:4,
   story:'Датчик нужно доставить к нестабильной кромке тектонической плиты.',focus:'вожаки и разломники',newTech:'контроль двух маршрутов',
   waves:[[g('leader',2,2.5),g('shell',8,1.6,'north',2)],[g('crawler',5,3),g('runner',11,1.1,'west',3)],[g('glider',10,1.6,'air'),g('spore',10,1.3,'north',4)],[g('crawler',7,2.8),g('leader',3,3.1,'north',5)]]},
  {n:12,name:'Сердце разлома',biome:'Тектонический разлом',mode:'defend',pattern:5,
   story:'Вибрация бурового комплекса будит древнего Глубинного титанта.',focus:'первое крупное существо',newTech:'тяжёлая оборона',
   waves:[[g('shell',9,2),g('stalker',8,1.2,'north',3)],[g('crawler',6,3),g('glider',8,1.4,'air',2)],[g('leader',4,2.7),g('crawler',5,2.9,'north',4)],[g('titan',1,1),g('shell',7,2,'west',7),g('glider',8,1.3,'air',8)]]},
  {n:13,name:'Хрустальный фронтир',biome:'Кристальное плато',mode:'relay',pattern:0,
   story:'Кристаллы усиливают сигнал трёх старых ретрансляторов.',focus:'охотники и разведчики',newTech:'резонансная установка',
   waves:[[g('glider',9,1.3,'air'),g('stalker',10,1.2)],[g('crawler',5,3),g('leader',3,2.8,'north',3)],[g('shell',7,2),g('glider',12,1.2,'air',2)],[g('stalker',12,1.1),g('crawler',6,3,'north',5)]]},
  {n:14,name:'Преобразователь',biome:'Кристальное плато',mode:'hold',pattern:1,
   story:'Учёные пытаются преобразовать кристаллический резонанс в энергию.',focus:'массированные наземные стаи',newTech:'защита конвертера',
   waves:[[g('spore',12,1.1),g('crawler',4,3,'north',5)],[g('leader',3,3),g('shell',10,1.5,'west',4)],[g('stalker',12,1.1,'north'),g('crawler',6,3.1,'west',5)],[g('glider',12,1.2,'air'),g('spore',15,1.1,'north',6)]]},
  {n:15,name:'Кристальный архив',biome:'Кристальное плато',mode:'escort',pattern:2,
   story:'Считыватели должны вынести данные с древних природных структур.',focus:'сильные воздушные налёты',newTech:'смена огневой позиции',
   waves:[[g('glider',10,1.3,'air'),g('runner',10,1.2,'north',3)],[g('shell',8,2.2),g('leader',3,3,'west',4)],[g('crawler',6,2.8,'north'),g('spore',12,1.1,'west',5)],[g('glider',14,1.1,'air'),g('stalker',10,1.3,'north',3)],[g('crawler',7,2.8),g('leader',4,3,'north',4)]]},
  {n:16,name:'Зелёный потолок',biome:'Кроны гигантов',mode:'remote',pattern:3,
   story:'Под зелёным сводом обнаружен новый маршрут животных.',focus:'быстрое наземное окружение',newTech:'акустическая приманка',
   waves:[[g('stalker',12,1.1),g('spore',12,1.2,'north',3)],[g('leader',4,3),g('crawler',5,3,'west',4)],[g('glider',12,1.2,'air'),g('shell',9,1.7,'north',5)],[g('stalker',16,1.0),g('leader',4,3,'north',5)]]},
  {n:17,name:'Лесной коридор',biome:'Кроны гигантов',mode:'escort',pattern:4,
   story:'Нужно эвакуировать биологов через живые корни гигантских деревьев.',focus:'охота на мобильную группу',newTech:'полевые приманки',
   waves:[[g('runner',12,1.1),g('stalker',8,1.1,'north',3)],[g('crawler',5,3),g('leader',4,3,'west',4)],[g('glider',13,1.1,'air'),g('spore',12,1.1,'north',3)],[g('stalker',16,1.0),g('shell',9,1.8,'west',3)],[g('leader',5,3,'north'),g('crawler',7,3,'west',5)]]},
  {n:18,name:'Дыхание леса',biome:'Кроны гигантов',mode:'relay',pattern:5,
   story:'Три датчика отслеживают звуковую реакцию лесной экосистемы.',focus:'стайные вожаки',newTech:'устойчивые полевые узлы',
   waves:[[g('leader',4,2.8),g('stalker',10,1.1,'north',3)],[g('crawler',6,2.8),g('shell',8,1.8,'west',3)],[g('glider',12,1.2,'air'),g('leader',4,3,'north',4)],[g('spore',18,1.0),g('crawler',7,2.8,'north',5)],[g('titan',1,1,'west'),g('stalker',10,1.1,'north',6)]]},
  {n:19,name:'Чёрные дюны',biome:'Обсидиановые дюны',mode:'defend',pattern:0,
   story:'Песчаные электрические штормы нарушают работу генераторов.',focus:'атаки с двух фронтов',newTech:'ремонтный бот',
   waves:[[g('stalker',14,1.1),g('shell',8,1.8,'north',3)],[g('crawler',7,2.8),g('leader',4,3,'west',3)],[g('glider',14,1.1,'air'),g('runner',12,1.1,'north',5)],[g('spore',16,1),g('crawler',7,2.7,'north',3)]]},
  {n:20,name:'Штормовая сеть',biome:'Обсидиановые дюны',mode:'relay',pattern:1,
   story:'Временные станции собирают данные о пылевых разрядах.',focus:'помехи и крупные звери',newTech:'ремонт в полевых условиях',
   waves:[[g('leader',5,2.8),g('shell',9,1.8,'north',3)],[g('crawler',8,2.9),g('stalker',14,1.1,'west',4)],[g('glider',15,1.2,'air'),g('spore',14,1.1,'north',3)],[g('crawler',10,2.8),g('leader',4,2.8,'north',4)]]},
  {n:21,name:'Ночной караван',biome:'Обсидиановые дюны',mode:'escort',pattern:2,
   story:'Караван с образцами пересекает пустыню под покровом ночи.',focus:'многоволновая погоня',newTech:'ремонт и сопровождение',
   waves:[[g('stalker',14,1.1),g('runner',12,1.1,'north',2)],[g('glider',13,1.2,'air'),g('shell',8,2.1,'west',3)],[g('crawler',8,2.9),g('leader',5,2.8,'north',4)],[g('spore',16,1.0),g('stalker',14,1.0,'north',3)],[g('titan',1,1),g('glider',13,1.2,'air',5),g('shell',8,1.8,'north',6)]]},
  {n:22,name:'Полярный сигнал',biome:'Кратер сияния',mode:'hold',pattern:3,
   story:'Силы экспедиции находят источник планетарного сигнала.',focus:'координированные стаи',newTech:'финальная оборона',
   waves:[[g('glider',15,1.2,'air'),g('crawler',7,3,'west',4)],[g('leader',5,2.5),g('stalker',15,1.1,'north',3)],[g('shell',10,1.8),g('titan',1,1,'north',6)],[g('glider',16,1.0,'air'),g('crawler',9,2.8,'west',3)]]},
  {n:23,name:'Граница миграции',biome:'Кратер сияния',mode:'remote',pattern:4,
   story:'Биологи устанавливают маяк, который уведёт мигрирующих зверей от лагеря.',focus:'искусство управления коридорами',newTech:'охранная сеть',
   waves:[[g('stalker',15,1.0),g('leader',4,2.8,'north',4)],[g('crawler',9,2.8),g('glider',14,1.1,'air',5)],[g('spore',19,.95),g('shell',9,1.8,'north',3)],[g('titan',1,1,'west'),g('leader',6,2.7,'north',6)],[g('glider',15,1.0,'air'),g('crawler',9,2.8,'north',4)]]},
  {n:24,name:'Не враги, а соседи',biome:'Кратер сияния',mode:'relay',pattern:5,
   story:'Последняя сеть направит миграцию в обход колонии, а матриарх защищает путь своей стаи.',focus:'Матриарх разлома',newTech:'финал экспедиции',
   waves:[[g('leader',5,2.6),g('crawler',8,2.8,'north',4)],[g('glider',15,1.1,'air'),g('stalker',16,1.0,'west',4)],[g('titan',1,1,'north'),g('shell',12,1.7,'west',5)],[g('crawler',10,2.8),g('leader',6,2.6,'north',4)],[g('monarch',1,1,'west'),g('glider',16,1.1,'air',5),g('stalker',14,1.0,'north',6)] ]}
];
const uniqueTypes=waves=>[...new Set(waves.flatMap(w=>w.map(g=>g.type)))];
function equipment(n){
  return {
    towers:['kinetic','pulse','mortar','antiAir',...(n>=7?['cryo']:[]),...(n>=13?['sonic']:[])],
    traps:['mine','slow',...(n>=16?['lure']:[])],
    units:['drone',...(n>=10?['infantry']:[]),...(n>=19?['repair']:[])]
  };
}
function createMission(blueprint,makeMap){
  const {n,mode,pattern}=blueprint,biome=blueprint.biome;
  const travel=mode==='remote'||mode==='escort';
  const hasAir=blueprint.waves.some(w=>w.some(g=>g.route==='air'));
  const hasNorth=blueprint.waves.some(w=>w.some(g=>g.route==='north'));
  const routes={};
  if(hasNorth)routes.north=NORTH[pattern];
  if(hasAir)routes.air=AIR;
  const obj={
    type:mode,maxHp:430+(n-7)*20,
    duration:mode==='escort'?0:mode==='relay'?72+(n-7)*2:90+(n-7)*3,
    ...(mode==='hold'?{holdRadius:1.75}:{}),
    ...(travel?{groupHp:260+(n-7)*15,teamSpeed:.95}:{}),
    ...(mode==='escort'?{stops:[2,4],stopSeconds:12}:{}),
    ...(mode==='relay'?{relayRadius:1.6}:{}),
  };
  const map=makeMap(24,14,ROUTE_PATTERNS[pattern],routes,travel?RESEARCH_PATH:[]);
  if(mode==='relay'){
    map.relaySites=[{col:5,row:11},{col:13,row:11},{col:20,row:10}];
    const occupied=new Set(map.relaySites.map(c=>String(c.col)+':'+String(c.row)));
    map.buildCells=map.buildCells.filter(c=>!occupied.has(String(c.col)+':'+String(c.row)));
  }
  const rewards={materials:320+(n-7)*32,data:50+(n-7)*6,
    firstMaterials:560+(n-7)*45,firstData:80+(n-7)*8};
  const starText=mode==='remote'||mode==='escort'?'группы':'научного прибора';
  return {
    id:'sector-'+String(n).padStart(2,'0'),number:n,name:blueprint.name,biome,
    summary:blueprint.story+' Главная угроза: '+blueprint.focus+'.',
    objective:obj,map,
    startSupply:1500+(n-7)*75,waveBonus:230+(n-7)*12,
    allowed:equipment(n),
    waves:blueprint.waves.map(groups=>({groups})),
    stars:[
      (mode==='escort'?'Эвакуировать исследователей':mode==='relay'?'Активировать все ретрансляторы':'Завершить исследование')+' и отразить все волны',
      'Сохранить ≥ '+(travel?50:60)+'% HP '+starText,
      mode==='escort'?'Не потерять ни одного развёрнутого дрона':
        'Не допустить повреждения '+starText
    ],
    rewards,
    briefing:[
      ['Зона '+n+' — '+blueprint.name,blueprint.story],
      ['Наблюдение', 'Разведка сообщает: '+blueprint.focus+'. В этом секторе встречаются: '+uniqueTypes(blueprint.waves).join(', ')+'.'],
      ['Научная задача',short[mode]+' Противники могут прийти с нескольких направлений; маршруты показаны на карте.'],
      ['Приказ', 'Доступное новое оборудование: '+blueprint.newTech+'. Первая победа даст '+(rewards.materials+rewards.firstMaterials)+' материалов и '+(rewards.data+rewards.firstData)+' данных.'+
        (n===24?' Защитите путь миграции, не разрушая экосистему.':'')]
    ],
    isFinal:n===24
  };
}
export function buildExpansion(makeMap){
  return SECTORS.map(x=>createMission(x,makeMap));
}
