import { TSE_ORIGIN } from './client';
export function officialPhoto(directory: string, id: string): string | null {
  if (!/^\d+$/.test(id)) return null;
  const url = new URL(`${directory}/${id}.jpeg`);
  return url.origin === TSE_ORIGIN && url.pathname.startsWith('/oficial/') ? url.toString() : null;
}
