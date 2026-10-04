export const number = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat('pt-BR').format(value);
export const percentage = (value: number | null | undefined) => value == null ? '—' : `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
export const clock = (date: string | null) => date ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(date)) : '—';
export const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('');
