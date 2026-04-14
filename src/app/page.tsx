import fs from 'fs';
import path from 'path';
import FilterBar from '@/components/FilterBar';
import SectionTitle from '@/components/SectionTitle';
import KPIGrid from '@/components/KPIGrid';
import KPICard from '@/components/KPICard';
import { formatPLN, formatNumber, formatPercent, formatDecimal } from '@/lib/formatters';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'executive-summary.json'), 'utf-8'));

function formatValue(value: number, format: string): string {
  switch (format) {
    case 'currency':
      return formatPLN(value);
    case 'percent':
      return formatPercent(value);
    case 'number':
      return formatNumber(value);
    case 'decimal':
      return formatDecimal(value, 1);
    case 'pp':
      return formatDecimal(value, 2) + ' pp';
    default:
      return String(value);
  }
}

export default function ExecutiveSummaryPage() {
  const { period, comparison, kpis, marketing } = data;

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        period={period.label}
        comparison={comparison.label}
      />

      <SectionTitle>Kluczowe wskazniki biznesowe</SectionTitle>

      <KPIGrid columns={4}>
        <KPICard
          label={kpis.revenue.label}
          value={formatValue(kpis.revenue.value, kpis.revenue.format)}
          change={kpis.revenue.change}
          changeDirection={kpis.revenue.changeDirection}
        />
        <KPICard
          label={kpis.aov.label}
          value={formatValue(kpis.aov.value, kpis.aov.format)}
          change={kpis.aov.change}
          changeDirection={kpis.aov.changeDirection}
        />
        <KPICard
          label={kpis.cr.label}
          value={formatValue(kpis.cr.value, kpis.cr.format)}
          change={kpis.cr.change}
          changeDirection={kpis.cr.changeDirection}
        />
        <KPICard
          label={kpis.transactions.label}
          value={formatValue(kpis.transactions.value, kpis.transactions.format)}
          change={kpis.transactions.change}
          changeDirection={kpis.transactions.changeDirection}
        />
      </KPIGrid>

      <KPIGrid columns={3}>
        <KPICard
          label={kpis.sessions.label}
          value={formatValue(kpis.sessions.value, kpis.sessions.format)}
          change={kpis.sessions.change}
          changeDirection={kpis.sessions.changeDirection}
        />
        <KPICard
          label={kpis.newCustomers.label}
          value={formatValue(kpis.newCustomers.value, kpis.newCustomers.format)}
          change={kpis.newCustomers.change}
          changeDirection={kpis.newCustomers.changeDirection}
        />
        <KPICard
          label={kpis.returningCustomers.label}
          value={formatValue(kpis.returningCustomers.value, kpis.returningCustomers.format)}
          change={kpis.returningCustomers.change}
          changeDirection={kpis.returningCustomers.changeDirection}
        />
      </KPIGrid>

      <SectionTitle className="mt-8">Efektywnosc marketingu</SectionTitle>

      <KPIGrid columns={3}>
        <KPICard
          label={marketing.spend.label}
          value={formatValue(marketing.spend.value, marketing.spend.format)}
          change={marketing.spend.change}
          changeDirection={marketing.spend.changeDirection}
        />
        <KPICard
          label={marketing.costShare.label}
          value={formatValue(marketing.costShare.value, marketing.costShare.format)}
          change={marketing.costShare.change}
          changeDirection={marketing.costShare.changeDirection}
        />
        <KPICard
          label={marketing.roas.label}
          value={formatValue(marketing.roas.value, marketing.roas.format)}
          change={marketing.roas.change}
          changeDirection={marketing.roas.changeDirection}
        />
      </KPIGrid>
    </div>
  );
}
