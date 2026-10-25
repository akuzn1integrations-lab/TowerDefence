import { MISSION_REWARDS, RESEARCH } from './config.js';
export const SAVE_KEY = 'towerdefence-nova7-v1';

export function newProgress() {
  return {
    schemaVersion: 1,
    unlockedSectorIds: ['sector-01'],
    sectors: {
      'sector-01': { briefingSeen: false, firstVictoryClaimed: false, bestStars: 0, victories: 0, attempts: 0 }
    },
    resources: { materials: 0, data: 0 },
    research: {},
    settings: { musicVolume: 0, sfxVolume: 0.7, reducedMotion: false }
  };
}
export function sanitizeProgress(candidate) {
  const safe = newProgress();
  if (!candidate || typeof candidate !== 'object' || candidate.schemaVersion !== 1) return safe;
  const section = candidate.sectors?.['sector-01'] || {};
  const cleanNumber = (value, max = 100000000) =>
    Number.isSafeInteger(value) && value >= 0 ? Math.min(value,max) : 0;
  safe.sectors['sector-01'] = {
    briefingSeen: section.briefingSeen === true,
    firstVictoryClaimed: section.firstVictoryClaimed === true,
    bestStars: Math.min(cleanNumber(section.bestStars), 3),
    victories: cleanNumber(section.victories),
    attempts: cleanNumber(section.attempts)
  };
  safe.resources = {
    materials: cleanNumber(candidate.resources?.materials),
    data: cleanNumber(candidate.resources?.data)
  };
  safe.research.precision = candidate.research?.precision === true;
  if (safe.sectors['sector-01'].victories > 0) {
    safe.sectors['sector-01'].firstVictoryClaimed = true;
    safe.unlockedSectorIds.push('sector-02');
  }
  safe.settings.reducedMotion = candidate.settings?.reducedMotion === true;
  return safe;
}
export function loadProgress(storage) {
  try {
    const source = storage ?? globalThis.localStorage;
    const raw = source.getItem(SAVE_KEY);
    if (!raw) return { progress: newProgress(), warning: '' };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schemaVersion !== 1) {
      return { progress: newProgress(), warning: 'Сохранение другой версии. Начата новая экспедиция.' };
    }
    return { progress: sanitizeProgress(parsed), warning: '' };
  } catch (_) {
    return { progress: newProgress(), warning: 'Не удалось прочитать сохранение. Прогресс этой сессии может не сохраняться.' };
  }
}
export function storeProgress(progress, storage) {
  try {
    const source = storage ?? globalThis.localStorage;
    source.setItem(SAVE_KEY, JSON.stringify(sanitizeProgress(progress)));
    return true;
  } catch (_) { return false; }
}
export function markBriefingSeen(progress) {
  progress.sectors['sector-01'].briefingSeen = true;
}
export function markAttempt(progress) {
  progress.sectors['sector-01'].attempts++;
}
// Вызывается один раз из обработчика завершения миссии, а не из рендера итогов.
export function grantVictory(progress, stars) {
  const sector = progress.sectors['sector-01'];
  if (!Number.isInteger(stars) || stars < 1 || stars > 3) throw new Error('Некорректные звёзды');
  const isFirst = !sector.firstVictoryClaimed;
  const rewards = {
    materials: MISSION_REWARDS.repeatable.materials + (isFirst ? MISSION_REWARDS.first.materials : 0),
    data: MISSION_REWARDS.repeatable.data + (isFirst ? MISSION_REWARDS.first.data : 0)
  };
  sector.bestStars = Math.max(sector.bestStars, stars);
  sector.victories++;
  sector.firstVictoryClaimed = true;
  progress.resources.materials += rewards.materials;
  progress.resources.data += rewards.data;
  if (!progress.unlockedSectorIds.includes('sector-02')) progress.unlockedSectorIds.push('sector-02');
  return { ...rewards, first: isFirst };
}
export function purchaseResearch(progress, id) {
  const item = RESEARCH[id];
  if (!item) return { ok:false, reason:'Неизвестная технология' };
  if (progress.research[id]) return { ok:false, reason:'Технология уже изучена' };
  if (progress.sectors['sector-01'].victories < 1) return { ok:false, reason:'Сначала завершите первую миссию' };
  if (progress.resources.materials < item.materials || progress.resources.data < item.data) {
    return { ok:false, reason:'Недостаточно ресурсов' };
  }
  progress.resources.materials -= item.materials;
  progress.resources.data -= item.data;
  progress.research[id] = true;
  return { ok:true };
}
