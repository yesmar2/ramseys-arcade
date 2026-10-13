/** A name as whose something is, the way it reads in a sentence: Snake’s page, Asteroids’ board. */
export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`
}
