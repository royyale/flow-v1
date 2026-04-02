export default function HealthScore({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color = score >= 80 ? "health-good" : score >= 60 ? "health-warning" : "health-critical";
  const strokeColor = score >= 80 ? "hsl(152, 60%, 48%)" : score >= 60 ? "hsl(38, 92%, 55%)" : "hsl(0, 72%, 55%)";
  
  const dims = { sm: 36, md: 48, lg: 64 };
  const s = dims[size];
  const strokeWidth = size === "sm" ? 3 : 4;
  const radius = (s - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: s, height: s }}>
      <svg width={s} height={s} className="-rotate-90">
        <circle cx={s / 2} cy={s / 2} r={radius} fill="none" stroke="hsl(222, 25%, 20%)" strokeWidth={strokeWidth} />
        <circle
          cx={s / 2} cy={s / 2} r={radius} fill="none"
          stroke={strokeColor} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className={`absolute text-xs font-semibold ${color}`}>
        {score}
      </span>
    </div>
  );
}
