/**
 * A picture's SVG as an address an <img> can show. Only what an address can't hold is escaped (and its double
 * quotes made single ones), which leaves it about the size it was: escaped whole, it's half as long again.
 */
export const svgAddress = (svg: string) => `data:image/svg+xml;charset=utf-8,${svg.replace(/"/g, "'").replace(/[#%<>]/g, encodeURIComponent)}`
