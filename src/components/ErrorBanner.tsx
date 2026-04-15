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
    <div className="glass-card border-red/20 px-5 py-4 flex items-start gap-3 text-[13px] animate-fade-up">
      <AlertTriangle className="h-4 w-4 text-red shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-red font-semibold text-[13px]">Wystapil blad</p>
        <p className="text-text-secondary mt-0.5 text-[12px]">{message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button onClick={onRetry} className="flex items-center gap-1 text-[11px] font-semibold text-red bg-red-subtle rounded-lg px-3 py-1.5 hover:bg-red/20 transition-colors cursor-pointer">
            <RefreshCw className="h-3 w-3" /> Ponow
          </button>
        )}
        {dismissible && (
          <button onClick={() => setDismissed(true)} className="text-text-muted hover:text-text transition-colors cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function PartialErrorBanner({ errors }: { errors: Record<string, string | null> }) {
  const failed = Object.entries(errors).filter(([, err]) => err !== null).map(([p]) => p);
  if (failed.length === 0) return null;

  return (
    <div className="glass-card border-yellow/20 px-5 py-3 flex items-center gap-3 text-[12px]">
      <AlertTriangle className="h-3.5 w-3.5 text-yellow shrink-0" />
      <span className="text-text-secondary">
        Nie udalo sie pobrac danych z:{' '}
        <span className="font-semibold text-text">{failed.join(', ')}</span>
      </span>
    </div>
  );
}
