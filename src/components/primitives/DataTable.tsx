'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/components/ui/cn';

type Props<T> = {
  data: T[];
  columns: ColumnDef<T, any>[];
  pageSize?: number;
  stickyFirstColumn?: boolean;
  className?: string;
};

export function DataTable<T>({
  data,
  columns,
  pageSize = 20,
  stickyFirstColumn = true,
  className,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const totalRows = data.length;
  const { pageIndex } = table.getState().pagination;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  return (
    <div className={cn('card overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--color-bg-elevated)] border-b border-[var(--color-border-subtle)]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h, i) => {
                  const sort = h.column.getIsSorted();
                  const canSort = h.column.getCanSort();
                  const isNumeric = (h.column.columnDef.meta as any)?.numeric;
                  return (
                    <th
                      key={h.id}
                      onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                      className={cn(
                        'px-4 py-3 overline text-left whitespace-nowrap select-none',
                        canSort && 'cursor-pointer hover:text-[var(--color-ink-primary)]',
                        isNumeric && 'text-right',
                        stickyFirstColumn && i === 0 && 'sticky left-0 bg-[var(--color-bg-elevated)] z-[1]'
                      )}
                    >
                      <div className={cn('inline-flex items-center gap-1', isNumeric && 'justify-end w-full')}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {canSort && (
                          sort === 'asc'
                            ? <ChevronUp size={12} className="text-[var(--color-accent-primary)]" />
                            : sort === 'desc'
                              ? <ChevronDown size={12} className="text-[var(--color-accent-primary)]" />
                              : <ChevronsUpDown size={11} className="opacity-40" />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-[13px] text-[var(--color-ink-tertiary)]"
                >
                  Brak danych w wybranym zakresie
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--color-border-subtle)] last:border-b-0 hover:bg-[var(--color-bg-elevated)]/60 transition-colors"
              >
                {row.getVisibleCells().map((cell, i) => {
                  const isNumeric = (cell.column.columnDef.meta as any)?.numeric;
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-4 py-3 text-[var(--color-ink-primary)] whitespace-nowrap',
                        isNumeric && 'text-right numeric',
                        stickyFirstColumn && i === 0 && 'sticky left-0 bg-[var(--color-bg-card)] z-[1] font-medium',
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalRows > pageSize && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border-subtle)] text-[12px] text-[var(--color-ink-secondary)]">
          <span className="numeric">
            {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalRows)} z {totalRows}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2.5 py-1 rounded-md hover:bg-[var(--color-bg-elevated)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ←
            </button>
            <span className="px-2 numeric">{pageIndex + 1} / {totalPages}</span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-2.5 py-1 rounded-md hover:bg-[var(--color-bg-elevated)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
