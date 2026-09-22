const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
]

/** A count the way it reads in a sentence: five, fifteen; past twenty, the figure. */
export function numberWord(n: number): string {
  return WORDS[n] ?? n.toLocaleString()
}
