import { PLATFORM_COLORS } from '@/lib/constants';

type Platform = keyof typeof PLATFORM_COLORS;

interface PlatformBadgeProps {
  platform: Platform;
}

const platformLabels: Record<Platform, string> = {
  google: 'Google Ads',
  meta: 'Meta Ads',
  pinterest: 'Pinterest',
  criteo: 'Criteo',
};

export default function PlatformBadge({ platform }: PlatformBadgeProps) {
  const colors = PLATFORM_COLORS[platform];

  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {platformLabels[platform]}
    </span>
  );
}
