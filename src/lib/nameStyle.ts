/* A tag's name style from the prize counter, as a class (styles/prizes.css). */

let pixelFontAsked = false

/** Pixel's arcade letters come from Google Fonts, like Outfit, but only once a pixel tag is on screen. */
export function askForPixelFont() {
  if (pixelFontAsked || typeof document === 'undefined') return
  pixelFontAsked = true
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Silkscreen&display=swap'
  document.head.appendChild(link)
}

/** The class for a name style, or '' for a plain tag. */
export function nameStyleClass(style: string | null | undefined): string {
  if (!style) return ''
  if (style === 'nm-pixel') askForPixelFont()
  return `pname pname--${style.slice(3)}`
}
