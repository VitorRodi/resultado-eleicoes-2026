'use client';
import { useState } from 'react';
import { initials } from '@/lib/formatting';
export default function Avatar({ name, url, large = false }: { name: string; url?: string | null; large?: boolean }) {
  const [failedUrl,setFailedUrl] = useState<string | null>(null);
  return <div className={`avatar ${large ? 'avatar-large' : ''}`}>
    {url && failedUrl !== url ?
      // Official external images fall back immediately when unavailable.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={`Foto oficial de ${name}`} onError={() => setFailedUrl(url)} loading="lazy" referrerPolicy="no-referrer" />
      : <span aria-label={name}>{initials(name)}</span>}
  </div>;
}
