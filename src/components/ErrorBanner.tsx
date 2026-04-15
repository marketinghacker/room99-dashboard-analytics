'use client';

import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  dismissible?: boolean;
}

export default function ErrorBanner({ message, onRetry, dismissible = true }: ErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-red-bg border border-red/20 rounded-lg px-4 py-3 flex items-start gap-3 text-[13px] animate-in fade-in slide-in-from-top-2 duration-300">
      <AlertTriangle className="h-4 w-4 text-red shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        <p className="text-red font-medium">Wystąpił błąd</p>
        <p className="text-text-secondary mt-0.5 text-[12px]">{message}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-[11px] font-medium text-red hover:text-red/80 bg-white/60 border border-red/20 rounded px-2 py-1 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            Ponów
          </button>
        )}
        {dismissible && (
          <button
            onClick={() => setDismissed(true)}
            className="text-text-secondary hover:text-text transition-colors cursor-pointer"
            title="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Partial error — shows which platform failed but allows dashboard to continue */
export function PartialErrorBanner({ errors }: { errors: Record<string, string | null> }) {
  const failedPlatforms = Object.entries(errors)
    .filter(([, err]) => err !== null)
    .map(([platform]) => platform);

  if (failedPlatforms.length === 0) return null;

  return (
    <div className="bg-yellow-bg border border-yellow/20 rounded-lg px-4 py-2.5 flex items-center gap-3 text-[12px]">
      <AlertTriangle className="h-3.5 w-3.5 text-yellow shrink-0" />
      <span className="text-text-secondary">
        Nie udało się pobrać danych z:{' '}
        <span className="font-medium text-text">
          {failedPlatforms.join(', ')}
        </span>
        . Pozostałe dane mogą być niekompletne.
      </span>
    </div>
  );
}
