import { clockNow } from '../../core/test-pins.js';
import { localDate } from '../../core/state.js';
import { AVATAR_LINES } from './speech.js';
import { companionIntent } from './companion.js';
import { $ } from '../../ui/dom.js';

export function createCompanionUI(app) {
  let lastLine = 0, lastIntent = null, activity = 'idle';

  // The companion speaks at the edges of focus and when tapped, never while
  // you focus, in Decorate or in the mini view, and not more than once every
  // twelve seconds on its own. An activity line may follow the pause line
  // sooner (`gap`), since it marks a new thing to see.
  function say(kind, { force = false, gap = 12_000 } = {}) {
    if (!app.speech || app.decorate.active || app.roomUI.compact || (!force && clockNow() - lastLine < gap)) return;
    if (app.speech.say('avatar', Array.isArray(kind) ? kind : AVATAR_LINES[kind])) lastLine = clockNow();
  }

  // Tell the room only when the companion's intent changes, not on every key
  // press, storage refresh or timer tick; each call also requests a frame.
  function syncIntent() {
    const intent = companionIntent(app.state.session);
    if (!app.room || intent === lastIntent) return;
    lastIntent = intent; app.room?.setActivity(intent);
  }

  function renderNote() {
    const minutes = app.state.history.filter(h => h.date === localDate()).reduce((sum, h) => sum + h.minutes, 0);
    const notes = { idle: 'Start focusing to work alongside your companion.', working: 'Your companion is working alongside you.', walking: 'A little stretch. Your companion is finding a cozy spot.', returning: 'Your companion is on the way back to the desk.', resting: 'A soft seat and a little breather. Take your time.', sleeping: 'Your companion has drifted off. Resume whenever you’re ready.', 'resting-at-desk': 'Your companion is taking a quiet break at the desk.', busy: 'Your companion is tending to the room.', 'at-door': 'Your companion is ready at the doorway.' };
    $('#daily-note').textContent = minutes ? `${minutes} quiet minutes made today. Look at you go.` : notes[activity];
  }

  function onItemInteraction({ kind }) {
    app.speech?.hide('avatar');
    const destination = { tea: 'On the way for tea', water: 'Going to tend the leaves', read: 'Finding a quiet page', rest: 'Finding a soft seat' };
    $('#companion-status-text').textContent = `Companion · ${destination[kind]}`;
  }

  function onCompanionTap({ state: mood, activity: doing }) {
    const lines = (mood === 'busy' || (mood === 'resting' && doing === 'read')) ? AVATAR_LINES.activity[doing] : AVATAR_LINES.tap[mood];
    if (app.speech && app.speech.say('avatar', lines || AVATAR_LINES.tap.idle)) lastLine = clockNow();
  }

  function onCompanionState({ state: mood, activity: doing }) {
    activity = mood;
    const labels = { idle: 'Ready at the desk', working: 'Working alongside you', walking: 'Finding a cozy spot', returning: 'Back to the desk', resting: 'Taking a breather', sleeping: 'Dozing off', customizing: 'Choosing a look', 'resting-at-desk': 'Resting at the desk', busy: 'Taking a little break', 'at-door': 'At the doorway' };
    const pet = app.pet.name();
    const tasks = { tea: 'Enjoying a little tea', warm: 'Warming up by the fire', window: 'Looking out of the window', water: 'Watering the plants', record: 'Putting on a record', pet: `Petting ${pet}`, lamp: 'Switching on a lamp', read: 'Reading a few pages' };
    const task = (mood === 'busy' || (mood === 'resting' && doing === 'read')) && tasks[doing];
    $('#companion-status').dataset.state = mood;
    $('#companion-status-text').textContent = `Companion · ${task || labels[mood] || 'In the room'}`;
    renderNote();
    if (mood === 'busy' && AVATAR_LINES.activity[doing]) say(AVATAR_LINES.activity[doing], { gap: 4000 });
    else if (mood === 'resting') say(doing === 'read' ? AVATAR_LINES.activity.read : 'rest');
    else if (mood === 'sleeping') say('doze');
  }

  // A hello after a long time away, but never in the middle of focus.
  function welcome() { if (!app.state.session.running) say('welcome', { force: true }); }

  return { say, syncIntent, renderNote, onItemInteraction, onCompanionTap, onCompanionState, welcome };
}
