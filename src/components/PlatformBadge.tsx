type Platform = 'google' | 'meta' | 'pinterest' | 'criteo';

interface PlatformBadgeProps {
  platform: Platform | string;
}

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  google: { label: 'Google Ads', color: 'var(--google)', bg: 'var(--google-bg)' },
  meta: { label: 'Meta Ads', color: 'var(--meta)', bg: 'var(--meta-bg)' },
  pinterest: { label: 'Pinterest', color: 'var(--pinterest)', bg: 'var(--pinterest-bg)' },
  criteo: { label: 'Criteo', color: 'var(--criteo)', bg: 'var(--criteo-bg)' },
};

export default function PlatformBadge({ platform }: PlatformBadgeProps) {
  const config = PLATFORM_CONFIG[platform] || { label: platform, color: '#666', bg: '#f5f5f5' };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
      {config.label}
    </span>
  );
}
