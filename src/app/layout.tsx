import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import TabNavigation from "@/components/TabNavigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Room99 — Dashboard Performance Marketing",
  description: "Dashboard Performance Marketing dla Room99.pl — Tekstylia Domowe",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`${geistSans.variable}`}>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)]" style={{ fontFamily: 'var(--font-geist-sans), "Google Sans", "Segoe UI", Roboto, sans-serif' }}>
        <Header />
        <TabNavigation />
        <main className="max-w-[1280px] mx-auto px-6 py-5 pb-16">
          {children}
        </main>
      </body>
    </html>
  );
}
