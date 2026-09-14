interface Props {
  score: number;
  size?: number;
}

function ringColor(score: number) {
  if (score >= 80) return "oklch(55% 0.16 150)";
  if (score >= 60) return "oklch(65% 0.16 70)";
  return "oklch(55% 0.2 25)";
}

export function ScoreRing({ score, size = 140 }: Props) {
  const radius = 52;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = ringColor(score);
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Score: ${score} out of 100`}>
      {/* Track */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none"
        stroke="oklch(90% 0.006 265)"
        strokeWidth={stroke}
      />
      {/* Progress */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      {/* Score text */}
      <text
        x={center} y={center - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size < 100 ? 22 : 32}
        fontWeight={700}
        fill={color}
        fontFamily="var(--font-sans)"
      >
        {score}
      </text>
      <text
        x={center} y={center + (size < 100 ? 16 : 22)}
        textAnchor="middle"
        fontSize={size < 100 ? 9 : 11}
        fill="oklch(48% 0.018 265)"
        fontFamily="var(--font-sans)"
      >
        / 100
      </text>
    </svg>
  );
}
