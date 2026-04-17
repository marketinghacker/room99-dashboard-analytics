import type { Metadata } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

/**
 * Fonts (all self-hosted via next/font, zero layout shift):
 *  - Fraunces: editorial serif for mastheads, H1, KPI numerals. Opsz axis
 *    enabled so large display renders at its optical size.
 *  - Inter: sans body.
 *  - JetBrains Mono: overlines, table headers, mono numbers.
 */
const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['opsz'],
});

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-inter',
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
      className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
