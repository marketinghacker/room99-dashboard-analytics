type Platform = 'google' | 'meta' | 'pinterest' | 'criteo';

const CONFIG: Record<string, { label: string; className: string }> = {
  google: { label: 'Google Ads', className: 'bg-[#e8f0fe] text-[#4285f4]' },
  meta: { label: 'Meta Ads', className: 'bg-[#e7f0ff] text-[#0668E1]' },
  pinterest: { label: 'Pinterest', className: 'bg-[#fce8ec] text-[#E60023]' },
  criteo: { label: 'Criteo', className: 'bg-[#fff3e0] text-[#ff6b35]' },
};

export default function PlatformBadge({ platform }: { platform: Platform | string }) {
  const c = CONFIG[platform] || { label: platform, className: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-[12px] px-2.5 py-0.5 text-[11px] font-semibold ${c.className}`}>
      {c.label}
    </span>
  );
}
