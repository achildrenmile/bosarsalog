export const EXERCISE_TYPES = [
  { value: 'Krisenkommunikationsübung', label: 'Krisenkommunikationsübung', short: 'KriKom' },
  { value: '80m Notfunk Runde', label: '80m Notfunk Runde', short: 'Notfunk' },
];

export const DEFAULT_EXERCISE_TYPE = 'Krisenkommunikationsübung';

export function getShortLabel(type: string): string {
  const found = EXERCISE_TYPES.find(t => t.value === type);
  return found ? found.short : type;
}
