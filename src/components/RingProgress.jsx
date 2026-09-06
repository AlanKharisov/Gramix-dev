import React, { memo } from "react";

const RingProgress = memo(function RingProgress({
  size = 116,
  stroke = 9,
  value,
  max,
  color = "var(--brand-mint)",
  overColor = "var(--brand-coral)",
  trackColor = "var(--surface-2)",
  pulse = false,
  children,
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(value / safeMax, 1.05);
  const dash = c * Math.min(pct, 1);
  const over = pct > 1;
  const stroke_color = over ? overColor : color;

  return (
    <div
      className={`ring-progress${over && pulse ? " ring-pulse" : ""}`}
      style={{ position: "relative", width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={stroke_color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 4,
        }}
      >
        {children}
      </div>
    </div>
  );
});

export default RingProgress;
