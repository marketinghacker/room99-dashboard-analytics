type Platform = 'google' | 'meta' | 'pinterest' | 'criteo';

interface PlatformBadgeProps {
  platform: Platform | string;
}

const CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  google: { label: 'Google Ads', color: 'var(--google)', bg: 'var(--google-subtle)' },
  meta: { label: 'Meta Ads', color: 'var(--meta)', bg: 'var(--meta-subtle)' },
  pinterest: { label: 'Pinterest', color: 'var(--pinterest)', bg: 'var(--pinterest-subtle)' },
  criteo: { label: 'Criteo', color: 'var(--criteo)', bg: 'var(--criteo-subtle)' },
};

export default function PlatformBadge({ platform }: PlatformBadgeProps) {
  const c = CONFIG[platform] || { label: platform, color: '#888', bg: 'rgba(255,255,255,0.06)' };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: c.color, boxShadow: `0 0 6px ${c.color}` }} />
      {c.label}
    </span>
  );
}
