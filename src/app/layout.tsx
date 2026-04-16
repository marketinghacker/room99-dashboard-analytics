import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Room99 — Performance Dashboard',
  description: 'Dashboard performance marketingowy dla Room99.pl — Meta, Google Ads, Pinterest, Criteo, GA4',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
