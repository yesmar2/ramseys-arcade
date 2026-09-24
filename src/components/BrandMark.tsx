import { useId } from 'react'
import { WORDMARK } from '../lib/wordmark'

const { letters, blip, box, shine } = WORDMARK

/**
 * The wordmark: "blıpka", its i dotted with a glowing blip. It is sized by
 * the font-size around it, like the text it stands in for, and its letters
 * take the text colour. The blip is drawn for both themes and
 * styles/chrome.css shows the one that fits: wide glow on dark, close on
 * light. Decorative: the link around it carries the name.
 */
export function BrandMark() {
  const id = `brand${useId().replace(/[^\w-]/g, '')}`
  return (
    <svg
      className="brand-mark"
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      width={`${box.width / 1000}em`}
      height={`${box.height / 1000}em`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {(['dark', 'light'] as const).map((theme) => (
          <radialGradient key={theme} id={`${id}-${theme}`}>
            {shine[theme].stops.map(([offset, opacity]) => (
              <stop key={offset} offset={offset} stopColor={shine[theme].glow} stopOpacity={opacity} />
            ))}
          </radialGradient>
        ))}
      </defs>
      <path d={letters} fill="currentColor" />
      {(['dark', 'light'] as const).map((theme) => (
        <g key={theme} className={`brand-mark__${theme}`}>
          <circle cx={blip.cx} cy={blip.cy} r={blip.r * shine[theme].reach} fill={`url(#${id}-${theme})`} />
          <circle cx={blip.cx} cy={blip.cy} r={blip.r} fill={shine[theme].core} />
        </g>
      ))}
    </svg>
  )
}
