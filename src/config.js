// Конфигурация первого вертикального среза. Никаких зависимостей от DOM.
export const CELL = 64;
export const GRID = { width: 20, height: 12 };
export const GENERATOR = { col: 18, row: 5, maxHp: 200 };
export const SPAWN = { col: 0, row: 5 };
export const TURRET = {
  id: 'kinetic', title: 'Кинетическая турель',
  cost: [100, 80, 125], damage: 12, shotsPerSecond: 1.25, range: 3,
  levels: [
    { damageMultiplier: 1, rangeMultiplier: 1 },
    { damageMultiplier: 1.25, rangeMultiplier: 1.10 },
    { damageMultiplier: 1.625, rangeMultiplier: 1.10, shotsMultiplier: 1.10 }
  ]
};
export const ENEMY = { id: 'skitter', title: 'Искрошмыг', maxHp: 55, speed: 1.2, reward: 10, contactDps: 10 };
export const WAVES = [
  { count: 5, interval: 2 },
  { count: 8, interval: 1.6 },
  { count: 12, interval: 1.2 }
];
export const SUPPLY_START = 400;
export const WAVE_BONUS = 100;
export const INSTALL_SECONDS = 80;
export const MISSION_REWARDS = {
  repeatable: { materials: 180, data: 20 },
  first: { materials: 320, data: 30 }
};
export const RESEARCH = {
  precision: { id: 'precision', name: 'Точный привод I', description: '+10% к урону кинетических турелей', materials: 250, data: 0 }
};
export const BRIEFING = [
  ['Новая почва', '«Ковчег» достиг поверхности Нова-7. Колонисты разворачивают первую энергетическую сеть.'],
  ['Неожиданная реакция', 'Мелкие стайные существа тянутся к теплу и вибрации генератора. Контакт может повредить оборудование.'],
  ['Ваша задача', 'Установите оборону вдоль коридора доступа. Не допускайте разрушения генератора до окончания монтажа.'],
  ['План защиты', 'Начните с кинетических турелей. Чем лучше сохранится генератор, тем больше звёзд получит экспедиция.']
];
export const BUILD_CELLS = [
  [1,3],[2,4],[3,6],[5,6],[6,4],[7,2],[7,5],[8,6],[10,2],
  [10,6],[11,8],[12,5],[13,6],[15,6],[16,4],[17,3],[18,7],[5,2]
].map(([col,row]) => ({col,row}));
const routeCorners = [
  [0,5],[4,5],[4,3],[9,3],[9,7],[14,7],[14,5],[18,5]
];
export function makeRoute() {
  const result = [];
  for (let i=0; i<routeCorners.length-1; i++) {
    const [startCol,startRow] = routeCorners[i];
    const [endCol,endRow] = routeCorners[i+1];
    const dc=Math.sign(endCol-startCol), dr=Math.sign(endRow-startRow);
    const steps=Math.abs(endCol-startCol)+Math.abs(endRow-startRow);
    for (let j= i===0?0:1; j<=steps; j++) {
      result.push({col:startCol+dc*j,row:startRow+dr*j});
    }
  }
  return result;
}
export const ROUTE = makeRoute();
export const cellKey = (col,row) => col + ':' + row;
export const PATH_KEYS = new Set(ROUTE.map(c => cellKey(c.col,c.row)));
export const BUILD_KEYS = new Set(BUILD_CELLS.map(c => cellKey(c.col,c.row)));
export function center(cell) { return { x: cell.col + 0.5, y: cell.row + 0.5 }; }
