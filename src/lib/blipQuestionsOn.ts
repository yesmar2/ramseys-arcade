/**
 * Whether Blip's question of the day shows on the site: his hello in the corner (and the card it opens), the menu's
 * and footer's links, Blip's questions (/blip, the home page while off), and the skins of his set still to win on a
 * game's page (one already won stays yours to wear). No request for it goes to the API while off. Off from 2026-11-17, Ramsey: "let's hide the blip questions for now. probably not useful
 * until we get a lot more people playing". The API keeps asking (a new question each day) and /admin still edits
 * them, so turning this back on picks up at that day's question.
 */
export const BLIP_QUESTIONS_ON = false
