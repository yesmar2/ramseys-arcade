import { isRankedGame } from '../data/games'
import { InfoTip } from './InfoTip'
import { FunIcon, RankedIcon } from './pastIcons'
import '../styles/dailyKind.css'

/*
 * Whether a daily places its players, said on it wherever the Dailies list it (the Dailies page's ticket,
 * the home page's row, the Dailies bar over each daily's page): "Ranked", in the green tick the game pages
 * say "Counts toward your rank" with, or "Just for fun", in their violet sparkle. Its tip says what that
 * means. Ramsey picked a label on every daily, with a tip on hover (2026-10-01).
 */

const WORDS = {
  ranked: {
    word: 'Ranked',
    lead: 'Counts toward your rank.',
    more: 'Your best today goes on the day’s board and into your week. It comes down to your hands, so nobody can give you the answer.',
  },
  fun: {
    word: 'Just for fun',
    lead: 'Doesn’t count toward your rank.',
    more: 'Your result still punches the Dailies and keeps your streak. There’s no board: the answer is the same for everyone, so a friend could just tell you.',
  },
} as const

/**
 * The tag. `look` dresses it for where it sits: `chip`, the word in a line of text; `pill`, on a picture;
 * `badge`, the mark alone on a small picture (the word is its name and its tip's head).
 */
export function DailyKindTag({ slug, look = 'chip', className }: { slug: string; look?: 'chip' | 'pill' | 'badge'; className?: string }) {
  const kind = isRankedGame(slug) ? 'ranked' : 'fun'
  const { word, lead, more } = WORDS[kind]
  const mark = kind === 'ranked' ? <RankedIcon /> : <FunIcon />
  return (
    <InfoTip
      className={`dkind dkind--${kind} dkind--${look}${className ? ` ${className}` : ''}`}
      tipClassName={`dkind-tip dkind-tip--${kind}`}
      label={look === 'badge' ? word : undefined}
      description={`${word}. ${lead} ${more}`}
      trigger={
        look === 'badge' ? (
          mark
        ) : (
          <>
            {mark}
            <span className="dkind__word">{word}</span>
          </>
        )
      }
    >
      <span className="dkind-tip__head">
        {mark}
        {word}
      </span>
      <span className="dkind-tip__lead">{lead}</span>
      <span className="dkind-tip__more">{more}</span>
    </InfoTip>
  )
}

/**
 * The mark alone, with no tip of its own, for inside something pressable (a phone's punch on the Dailies
 * ticket, which shows its daily's tag big when pressed): before a word (`mark`), or a badge on a picture's
 * corner (`badge`). Its word is there for a screen reader.
 */
export function DailyKindMark({ slug, look = 'mark', className }: { slug: string; look?: 'mark' | 'badge'; className?: string }) {
  const kind = isRankedGame(slug) ? 'ranked' : 'fun'
  return (
    <span className={`dkind dkind--${kind} dkind--${look}${className ? ` ${className}` : ''}`}>
      {kind === 'ranked' ? <RankedIcon /> : <FunIcon />}
      <span className="visually-hidden">{WORDS[kind].word}, </span>
    </span>
  )
}
