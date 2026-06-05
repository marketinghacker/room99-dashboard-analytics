import type { Metadata } from 'next';
import { Montserrat, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

/**
 * Fonts (all self-hosted via next/font, zero layout shift):
 *  - Montserrat: brand sans (substytut Gotham Book — klient używa Gothama,
 *    Montserrat to standardowy wolnolicencyjny odpowiednik). Display i body.
 *  - JetBrains Mono: overlines, table headers, mono numbers.
 */
const montserrat = Montserrat({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-montserrat',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600'],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'Room99 — Performance Dashboard',
  description:
    'Dashboard performance marketingowy dla Room99.pl — Meta, Google Ads, Pinterest, Criteo, GA4',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pl"
      data-theme="editorial"
      data-role="agency"
      className={`${montserrat.variable} ${jetbrains.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
