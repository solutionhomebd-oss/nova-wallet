import { useId } from 'react'

// The NovaWallet "N" as a loading indicator: the logo's 24 pulse bars
// ripple in a travelling wave (each bar scales with a staggered delay —
// see .nw-wave-bar in index.css). Bar geometry matches LogoMark exactly,
// so the loader IS the logo, animated. Gradient ids are unique per
// instance (useId) — the same rule LogoMark follows.
const BARS: [number, number, number][] = [
  [10.0, 10.2, 79.4], [13.5, 10.4, 79.2], [16.8, 10.2, 79.4], [20.3, 10.4, 79.2], [23.8, 10.2, 79.4], [27.1, 10.4, 79.2],
  [30.7, 10.4, 33.2], [34.2, 12.5, 35.5], [37.5, 16.8, 35.5], [40.4, 20.7, 35.4], [43.0, 24.0, 36.2], [46.3, 27.7, 36.6],
  [49.4, 31.8, 36.8], [52.9, 36.3, 36.9], [56.6, 41.0, 36.9], [60.2, 45.3, 36.7], [63.7, 50.4, 36.3], [67.0, 54.7, 34.9],
  [70.5, 10.2, 79.4], [73.8, 10.2, 79.4], [77.3, 10.2, 79.4], [80.9, 10.2, 79.4], [84.4, 10.2, 79.4], [87.7, 10.2, 79.4],
]

export default function LogoLoader({ size = 60 }: { size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const grad = `nw-load-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Loading" style={{ filter: 'drop-shadow(0 6px 18px rgba(139,92,246,0.35))' }}>
      <defs>
        <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="8" y1="0" x2="92" y2="0">
          <stop offset="0%" stopColor="#9b30ff" />
          <stop offset="45%" stopColor="#7a5cff" />
          <stop offset="62%" stopColor="#5f74fc" />
          <stop offset="100%" stopColor="#1ed2f8" />
        </linearGradient>
      </defs>
      <g fill={`url(#${grad})`}>
        {BARS.map(([x, y, h], i) => (
          <rect key={i} x={x} y={y} width={2.2} height={h} rx={1.1} className="nw-wave-bar" style={{ animationDelay: `${i * 55}ms` }} />
        ))}
      </g>
    </svg>
  )
}

/** Centred page/section loader: the wave logo plus an optional caption. */
export function PageLoader({ label, compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${compact ? 'py-6' : 'py-16'}`}>
      <LogoLoader size={compact ? 44 : 60} />
      {label && <p className="text-sm font-semibold text-slate-400">{label}</p>}
    </div>
  )
}
