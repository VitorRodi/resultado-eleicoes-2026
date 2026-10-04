import type { Metadata } from 'next';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'Resultado Eleições 2026 | Brasil e estados',
  description: 'Resultados oficiais do TSE por estado e presidência nacional. Escolha a UF, candidatos e municípios para acompanhar a apuração.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
