'use client';

interface FunnelStep {
  name: string;
  users: number;
  conversionRate: number;
}

interface FunnelChartProps {
  steps: FunnelStep[];
}

export default function FunnelChart({ steps }: FunnelChartProps) {
  if (steps.length === 0) return null;

  const maxUsers = steps[0].users;

  // Generate a gradient of blue colors from light to dark
  const getBarColor = (index: number) => {
    const colors = [
      '#1a73e8', // primary blue
      '#4285f4', // lighter blue
      '#669df6', // even lighter
      '#8ab4f8', // lightest
      '#aecbfa', // very light
      '#c6dafc', // ultra light
    ];
    return colors[Math.min(index, colors.length - 1)];
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex flex-col gap-2">
        {steps.map((step, idx) => {
          const widthPercent = maxUsers > 0 ? (step.users / maxUsers) * 100 : 0;
          const barWidth = Math.max(widthPercent, 10); // min 10% width for visibility

          return (
            <div key={idx}>
              {/* Step bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div
                    className="relative rounded py-3 px-4 transition-all"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: getBarColor(idx),
                      minWidth: 120,
                    }}
                  >
                    <span className="text-white text-[13px] font-semibold whitespace-nowrap">
                      {step.name}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right min-w-[120px]">
                  <span className="text-[14px] font-bold text-text">
                    {step.users.toLocaleString('pl-PL')}
                  </span>
                  <span className="text-[12px] text-text-secondary ml-1">
                    użytkowników
                  </span>
                </div>
              </div>

              {/* Conversion rate between steps */}
              {idx < steps.length - 1 && (
                <div className="flex items-center gap-2 ml-6 my-1">
                  <svg
                    width="12"
                    height="16"
                    viewBox="0 0 12 16"
                    className="text-text-secondary"
                  >
                    <path
                      d="M6 0 L6 12 L2 8 M6 12 L10 8"
                      stroke="currentColor"
                      fill="none"
                      strokeWidth="1.5"
                    />
                  </svg>
                  <span className="text-[11px] font-semibold text-text-secondary">
                    {step.conversionRate.toLocaleString('pl-PL', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    % konwersji
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
