import { formatPLN, formatNumber, formatPercent, formatDecimal } from '@/lib/formatters';
import type { ReactNode } from 'react';

export interface ColumnDef {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'currency' | 'percent' | 'number' | 'decimal' | 'text' | 'component';
}

interface DataTableProps {
  columns: ColumnDef[];
  data: Array<Record<string, unknown>>;
  totalRow?: Record<string, unknown>;
}

function formatCell(value: unknown, format?: ColumnDef['format']): ReactNode {
  if (value === null || value === undefined) return '—';

  switch (format) {
    case 'currency':
      return formatPLN(Number(value));
    case 'percent':
      return formatPercent(Number(value));
    case 'number':
      return formatNumber(Number(value));
    case 'decimal':
      return formatDecimal(Number(value), 2);
    case 'component':
      return value as ReactNode;
    case 'text':
    default:
      return String(value);
  }
}

export default function DataTable({ columns, data, totalRow }: DataTableProps) {
  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-wire-bg border-b-2 border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`
                  px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary
                  ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                `}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              className="border-b border-border last:border-b-0 hover:bg-[var(--wire-bg)] transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`
                    px-3 py-2.5
                    ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                  `}
                >
                  {formatCell(row[col.key], col.format)}
                </td>
              ))}
            </tr>
          ))}
          {/* Total row */}
          {totalRow && (
            <tr className="bg-wire-bg font-bold border-t-2 border-border">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`
                    px-3 py-2.5
                    ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                  `}
                >
                  {formatCell(totalRow[col.key], col.format)}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
