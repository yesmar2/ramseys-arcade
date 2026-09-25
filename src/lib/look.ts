import '../styles/look.css'

/*
 * A look on trial, on one device, so it can be judged on the real site before
 * anyone else sees it. `?look=new` on any address turns it on: the redrawn
 * game logos (components/gameLogos.tsx) wherever a game's mark shows, and
 * cabinets that keep their logo up until the game is asked to play (a pointer
 * over one, focus on it, or on a phone its being the one nearest the middle
 * of the screen), then put it back when the game stops. `?look=old` is the
 * site as it is. Once either has been asked for, a pill at the foot of the
 * page switches between them, and its × ends the trial.
 */
export type Look = 'new' | 'old'

const KEY = 'skermix-look'

let look: Look = 'old'

export function lookIsNew() {
  return look === 'new'
}

export function bootLook() {
  let asked = false
  try {
    const param = new URLSearchParams(window.location.search).get('look')
    if (param === 'new' || param === 'old') localStorage.setItem(KEY, param)
    const kept = localStorage.getItem(KEY)
    asked = kept === 'new' || kept === 'old'
    look = kept === 'new' ? 'new' : 'old'
  } catch {
    /* storage is off: the site as it is */
  }
  document.documentElement.dataset.look = look
  if (asked) showSwitch()
}

function choose(next: Look | null) {
  try {
    if (next) localStorage.setItem(KEY, next)
    else localStorage.removeItem(KEY)
  } catch {
    /* nothing kept; the reload shows the site as it is */
  }
  // Drop the address's own ?look= so it doesn't choose again on the reload.
  const url = new URL(window.location.href)
  url.searchParams.delete('look')
  window.location.replace(url.toString())
}

/** The pill: which logos are up, the other to switch to, and × to end the trial. */
function showSwitch() {
  const bar = document.createElement('div')
  bar.className = 'look-switch'
  bar.setAttribute('role', 'group')
  bar.setAttribute('aria-label', 'Logos on trial')

  const label = document.createElement('span')
  label.className = 'look-switch__label'
  label.textContent = 'Logos'
  bar.append(label)

  const options: Array<[Look, string]> = [
    ['old', 'Today'],
    ['new', 'New'],
  ]
  for (const [value, text] of options) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'look-switch__option'
    button.textContent = text
    button.setAttribute('aria-pressed', String(look === value))
    button.addEventListener('click', () => {
      if (look !== value) choose(value)
    })
    bar.append(button)
  }

  const end = document.createElement('button')
  end.type = 'button'
  end.className = 'look-switch__end'
  end.textContent = '×'
  end.setAttribute('aria-label', 'End the trial')
  end.addEventListener('click', () => choose(null))
  bar.append(end)

  document.body.append(bar)
}
