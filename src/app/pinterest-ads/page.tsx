'use client';

import SectionTitle from '@/components/SectionTitle';
import KPIGrid from '@/components/KPIGrid';
import KPICard from '@/components/KPICard';
import { formatPLN, formatNumber, formatPercent, formatDecimal } from '@/lib/formatters';
import { AlertTriangle } from 'lucide-react';

/**
 * Pinterest Ads — CSV-based, no API.
 * Shows a message instructing the user to upload data via admin panel.
 * In the future, if CSV data is available, it will be loaded from localStorage or a server-side store.
 */
export default function PinterestAdsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Manual import warning */}
      <div className="flex items-start gap-3 rounded-lg border border-yellow/40 bg-yellow-bg px-4 py-3">
        <AlertTriangle className="h-5 w-5 text-yellow shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-semibold text-yellow">Dane wymagaja importu recznego</p>
          <p className="text-[12px] text-text-secondary mt-0.5">
            Pinterest Ads API nie jest podlaczone. Dane na tej stronie pochodza z ostatniego recznego uploadu CSV.
            Przejdz do{' '}
            <a href="/admin/pinterest-upload" className="text-primary underline hover:no-underline">
              panelu administracyjnego
            </a>
            , aby zaimportowac aktualne dane.
          </p>
        </div>
      </div>

      <SectionTitle>Metryki ogolne — Pinterest Ads</SectionTitle>

      <KPIGrid columns={4}>
        <KPICard label="Wydatki" value="—" suffix="brak danych" />
        <KPICard label="Przychod" value="—" suffix="brak danych" />
        <KPICard label="ROAS" value="—" suffix="brak danych" />
        <KPICard label="CR" value="—" suffix="brak danych" />
      </KPIGrid>

      <div className="bg-card border border-border rounded-lg p-8 text-center text-text-secondary text-[13px]">
        Zaladuj plik CSV z danymi Pinterest Ads, aby zobaczyc metryki.
      </div>
    </div>
  );
}
