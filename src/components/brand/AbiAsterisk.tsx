/** El asterisco de Agave (6 puntas), mismo trazo que la marca del portal. */
export function AbiAsterisk({ className = '', color = '#f2ed5c' }: { className?: string; color?: string }) {
  const c = 50
  const r = 50 * 0.86
  const lines = Array.from({ length: 3 }, (_, i) => {
    const a = (i * 60 * Math.PI) / 180
    return {
      x1: c - Math.cos(a) * r,
      y1: c - Math.sin(a) * r,
      x2: c + Math.cos(a) * r,
      y2: c + Math.sin(a) * r,
    }
  })
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      {lines.map((l, i) => (
        <line key={i} {...l} stroke={color} strokeWidth={16} strokeLinecap="round" />
      ))}
    </svg>
  )
}
