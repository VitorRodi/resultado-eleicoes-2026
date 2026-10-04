import type { Office } from '../types/election';
export const OFFICE_CONFIG: Record<Office, { code: number; label: string; type: number }> = {
  president: { code: 1, label: 'Presidente', type: 8 },
  governor: { code: 3, label: 'Governador', type: 1 },
  senator: { code: 5, label: 'Senado', type: 1 },
  federalDeputy: { code: 6, label: 'Deputado federal', type: 1 },
  stateDeputy: { code: 7, label: 'Deputado estadual', type: 1 },
};
export function canonical(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
