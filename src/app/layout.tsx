import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Room99 — Performance Dashboard",
  description: "Dashboard performance marketingowy dla Room99.pl",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
