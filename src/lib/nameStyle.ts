/* A tag's name style from the prize counter, as a class (styles/prizes.css). */

const fontsAsked = new Set<string>()

/** A name style's letters from Google Fonts, like Outfit, but only once a tag wearing it is on screen. */
function askForFont(family: string) {
  if (fontsAsked.has(family) || typeof document === 'undefined') return
  fontsAsked.add(family)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`
  document.head.appendChild(link)
}

/** Pixel's arcade letters. */
export function askForPixelFont() {
  askForFont('Silkscreen')
}

/** Season 1's lettering (Space Race): its page, its banner and the Countdown name style. */
export function askForOrbitronFont() {
  askForFont('Orbitron:wght@700;800')
}

/** The class for a name style, or '' for a plain tag. */
export function nameStyleClass(style: string | null | undefined): string {
  if (!style) return ''
  if (style === 'nm-pixel') askForPixelFont()
  // Countdown, from Season 1's pass, in the season's lettering.
  if (style === 'nm-countdown') askForOrbitronFont()
  return `pname pname--${style.slice(3)}`
}
