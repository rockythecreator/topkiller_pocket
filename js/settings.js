import { validateLambda } from './math.js';
export const STORAGE_KEY = 'topkiller-pocket:v0.1';
export const DEFAULTS = Object.freeze({ homeName: 'Squadra Casa', awayName: 'Squadra Ospite', homeLambda: 1.45, awayLambda: 1.10 });
export function cleanSettings(value) {
  const settings = { ...DEFAULTS };
  if (!value || typeof value !== 'object') return settings;
  for (const key of ['homeName', 'awayName']) {
    if (typeof value[key] === 'string' && value[key].trim()) settings[key] = value[key].trim().slice(0, 40);
  }
  for (const key of ['homeLambda', 'awayLambda']) {
    try { validateLambda(value[key]); settings[key] = Math.round(value[key] * 100) / 100; } catch { /* Use default for invalid data. */ }
  }
  return settings;
}
export function loadSettings(storage) {
  try { return cleanSettings(JSON.parse(storage.getItem(STORAGE_KEY))); } catch { return { ...DEFAULTS }; }
}
export function saveSettings(storage, settings) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(cleanSettings(settings))); return true; } catch { return false; }
}
