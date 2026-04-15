import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import TabNavigation from "@/components/TabNavigation";
import ClientProviders from "@/components/ClientProviders";
import FilterBar from "@/components/FilterBar";

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
      <body className="min-h-screen relative">
        <ClientProviders>
          <Header />
          <TabNavigation />
          <main className="max-w-[1400px] mx-auto px-6 pt-6 pb-20 space-y-6 relative z-10">
            <FilterBar />
            {children}
          </main>
        </ClientProviders>
      </body>
    </html>
  );
}
