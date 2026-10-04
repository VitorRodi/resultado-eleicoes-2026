import type { Office, TrackedKey } from '../types/election';
export const MUNICIPALITIES = [
  'Bom Jesus do Oeste', 'Riqueza', 'Caibi', 'Palmitos', 'Águas de Chapecó',
  'São Carlos', 'Planalto Alegre', 'Cunha Porã', 'Saudades',
] as const;
export const OFFICE_CONFIG: Record<Office, { code: number; label: string; type: number }> = {
  president: { code: 1, label: 'Presidente', type: 8 },
  governor: { code: 3, label: 'Governador', type: 1 },
  senator: { code: 5, label: 'Senado', type: 1 },
  federalDeputy: { code: 6, label: 'Deputado federal', type: 1 },
  stateDeputy: { code: 7, label: 'Deputado estadual', type: 1 },
};
export const TRACKED: Record<TrackedKey, { name: string; office: Office }> = {
  danielaReinehr: { name: 'Daniela Reinehr', office: 'federalDeputy' },
  oscarGutz: { name: 'Oscar Gutz', office: 'stateDeputy' },
};
export function canonical(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
