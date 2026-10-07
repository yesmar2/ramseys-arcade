import { mixColor } from '../../lib/color'
import { heightAt, hillsSpan, mulberry32, type Hills } from './sim'

/** The drawing's own shape. It covers any box at least this wide for its height, cropping sky and earth to fit. */
const ASPECT = 1.55

/**
 * A day's hills from the side, as the Hills Book draws them: the whole way from the start to the line at dusk,
 * the tops stretched up so a card shows them, washed in the day's colour with a lit edge, the three flags and
 * the chequered line. The players' cards show the day's postcard instead (HillsPostcard.tsx). It covers the
 * box it's put in, keeping the hills in its middle band so a wide box crops only sky and earth.
 */
export function HillsDrawing({ hills, className }: { hills: Hills; className?: string }) {
  const h = 100
  const w = h * ASPECT
  const [lo, hi] = hillsSpan(hills)
  const x0 = -hills.finish * 0.03
  const x1 = hills.finish * 1.04
  const kx = w / (x1 - x0)
  const X = (x: number) => ((x - x0) * kx).toFixed(1)
  // The hills fill the middle band, stretched up no more than four times, so they still roll rather than spike.
  const ky = Math.min((h * 0.36) / Math.max(1, hi - lo), kx * 4)
  const Y = (y: number) => (h * 0.56 + ((lo + hi) / 2 - y) * ky).toFixed(1)
  // A point every four or five metres of hills, so even the quickest bumps keep their shape.
  const steps = Math.max(260, Math.round(hills.finish / 4.5))
  const line: string[] = []
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps
    line.push(`${X(x)} ${Y(heightAt(hills, x))}`)
  }
  const ground = `M${line.join(' L')} L${w.toFixed(1)} ${h} L0 ${h} Z`
  // Far hills behind: the near ones, smoothed and lifted.
  const far: string[] = []
  for (let i = 0; i <= 60; i++) {
    const x = x0 + ((x1 - x0) * i) / 60
    let sum = 0
    for (let k = -4; k <= 4; k++) sum += heightAt(hills, x + k * 18)
    far.push(`${X(x)} ${(Number(Y(sum / 9)) - h * 0.13).toFixed(1)}`)
  }
  const back = `M${far.join(' L')} L${w.toFixed(1)} ${h} L0 ${h} Z`
  const hue = hills.hue
  const id = `hills-${hills.n}-${hills.attempt}`
  const rnd = mulberry32(hills.n * 977 + 13)
  const stars = Array.from({ length: 30 }, () => ({ x: rnd() * w, y: 12 + rnd() * h * 0.4, r: 0.25 + rnd() * 0.5, o: 0.3 + rnd() * 0.6 }))
  const flagH = h * 0.1
  const finishY = Number(Y(heightAt(hills, hills.finish)))
  const fx = Number(X(hills.finish))
  const cell = flagH * 0.24
  return (
    <svg className={className} viewBox={`0 0 ${w.toFixed(1)} ${h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${hills.name}, from the side`}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.15" stopColor="#0a0e29" />
          <stop offset="0.75" stopColor="#47306b" />
        </linearGradient>
        <linearGradient id={`${id}-earth`} x1="0" y1="0.3" x2="0" y2="1">
          <stop offset="0" stopColor={mixColor(hue, '#0e1230', 0.45)} />
          <stop offset="1" stopColor={mixColor(hue, '#0e1230', 0.72)} />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}-sky)`} />
      {stars.map((s, i) => (
        <circle key={i} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)} fill="#ffffff" opacity={s.o.toFixed(2)} />
      ))}
      <circle cx={(w * 0.84).toFixed(1)} cy={(h * 0.28).toFixed(1)} r={h * 0.06} fill="#f3ecd2" />
      <path d={back} fill={mixColor(hue, '#1b1745', 0.72)} />
      <path d={ground} fill={`url(#${id}-earth)`} />
      <path d={`M${line.join(' L')}`} fill="none" stroke={mixColor(hue, '#ffffff', 0.5)} strokeWidth={h * 0.012} strokeLinejoin="round" />
      {hills.flags.map((x, i) => {
        const px = Number(X(x))
        const py = Number(Y(heightAt(hills, x)))
        return (
          <g key={i}>
            <line x1={px} y1={py} x2={px} y2={py - flagH} stroke="#e7eef3" strokeWidth={h * 0.008} opacity="0.75" />
            <path d={`M${px} ${py - flagH} L${px + flagH * 0.5} ${py - flagH * 0.82} L${px} ${py - flagH * 0.64} Z`} fill="#f5b942" />
          </g>
        )
      })}
      <line x1={fx} y1={finishY} x2={fx} y2={finishY - flagH * 1.3} stroke="#e7eef3" strokeWidth={h * 0.01} />
      {[0, 1, 2].map((r) =>
        [0, 1].map((q) => (
          <rect
            key={`${r}-${q}`}
            x={fx + q * cell}
            y={finishY - flagH * 1.3 + r * cell}
            width={cell}
            height={cell}
            fill={(r + q) % 2 === 0 ? '#e7eef3' : '#0e1230'}
          />
        )),
      )}
    </svg>
  )
}
