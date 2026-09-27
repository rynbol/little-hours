import { icon } from '../ui/icons.js';
import { blossomArt, coinArt } from '../ui/ui-art.js';

export const shellMarkup = (audioPrefs) => `
  <a class="skip-link" href="#start-button">Skip to focus timer</a>
  <div class="app-shell">
    <header class="app-header">
      <a class="brand" href="/" aria-label="Little Hours home"><span class="brand-mark">${icon('home')}</span><span>little hours<span class="brand-dot">.</span></span></a>
      <span class="brand-tagline">a little time, a little magic</span><div class="header-right"><button class="coin-wallet" id="coin-wallet" aria-label="Your house and coins">${coinArt()}<span id="coin-balance">0</span><span>coins</span></button><button class="time-toggle" id="time-toggle" aria-label="Switch to daylight" title="Switch to daylight">${icon('moon')}<span>Night</span></button><button class="focus-toggle" id="focus-toggle" aria-expanded="true" aria-controls="focus-card" aria-label="Hide focus panel">${icon('clock')}<span>Focus</span><span id="dock-timer">25:00</span></button></div>
    </header>
    <main class="workspace">
      <section id="room-section" class="room-section" aria-labelledby="room-title">
        <div class="room-heading"><div><p class="eyebrow">MAKE YOURSELF AT HOME</p><h1 id="room-title">The twilight retreat</h1><p class="room-subtitle" id="room-subtitle">The fire is warm. The night is yours.</p></div><div class="heading-actions"><button class="mode-button" id="rooms-button" aria-label="Visit your house" aria-controls="house-page">${icon('home')}<span>My house</span></button><button class="mode-button" id="decorate-button" aria-pressed="false" aria-controls="builder-panel">${icon('build')}<span>Decorate</span></button><button class="icon-button" id="reset-view" aria-label="Reset room view">${icon('reset')}</button></div></div>
        <nav id="home-connections" class="home-connections" aria-label="Move around your house"></nav>
        <div class="avatar-stage-heading"><span class="eyebrow">YOUR EVERYDAY KIND OF MAGIC</span><span class="avatar-pause-note" id="avatar-pause-note"></span></div>
        <div class="stage" id="stage">
          <div class="portrait-backdrop" aria-hidden="true"><span>✧</span><span>✦</span><span>✧</span></div>
          <div class="avatar-preview-controls" aria-label="Turn your avatar"><button id="avatar-turn-left" aria-label="Turn avatar left">${icon('rotate')}</button><span>Drag to turn</span><button id="avatar-turn-right" aria-label="Turn avatar right">${icon('rotate')}</button><button id="avatar-face-front">Face me</button></div>
          <div class="room-canvas" id="room-canvas" aria-label="Interactive 3D cutaway study room with a desk, bookshelf, plants and a pet. Drag to turn the room."></div>
          <div id="house-in-room" class="house-in-room" hidden></div>
          <div id="room-travel" class="room-travel" role="status" hidden><span>${icon('leaf')}</span><div><strong id="travel-label"></strong><small>A different corner of home.</small></div><div class="journey-progress" aria-hidden="true"><i id="journey-progress-fill"></i></div></div>
          <div class="loading-note" id="loading-note">Making room for you…</div>
          <div class="stage-presence" id="stage-presence" data-presence="idle" role="status" aria-live="polite" aria-atomic="true" aria-label="Your local focus status: In your room" title="Your focus status in this browser."><span id="presence-icon" aria-hidden="true">${icon('home')}</span><span id="room-status">In your room</span></div>
          <div class="companion-status" id="companion-status" data-state="idle" role="status" aria-live="polite"><span aria-hidden="true">✧</span><span id="companion-status-text">Companion · Ready at the desk</span></div>
          <div class="mini-caption" id="mini-caption" hidden>Mini view preview · inside this page</div>
          <div class="room-hint" id="room-hint">Drag to look around<span>·</span>Tap a plant, bookcase or tea table</div>
        </div>
        <div class="room-bottom">
          <div class="room-company">${icon('cat')}<span id="pet-company">You & Miso</span></div>
          <nav class="room-tools" aria-label="Room controls">
            <button class="tool" data-panel="atmosphere" aria-expanded="false" aria-controls="room-panel">${icon('sun')}<span>Ambience</span></button>
            <button class="tool" id="pet-button" data-panel="pet" aria-expanded="false" aria-controls="room-panel">${icon('cat')}<span id="pet-button-label">Miso</span></button>
            <button class="tool" id="avatar-button" data-panel="avatar" aria-expanded="false" aria-controls="room-panel">${icon('avatar')}<span>Avatar</span></button>
            <button class="tool" id="mini-button" aria-pressed="false">${icon('mini')}<span>Mini view</span></button>
            <button class="tool" data-panel="performance" aria-label="Performance and quality" title="Performance and quality" aria-expanded="false" aria-controls="room-panel">${icon('gauge')}<span>Quality</span></button>
          </nav>
        </div>
        <div class="room-panel" id="room-panel" hidden></div>
        <section class="builder-panel" id="builder-panel" aria-label="Room decorator" hidden>
          <div class="builder-heading"><div class="collection-tabs" aria-label="Decoration collections"><button data-collection-tab="collection" aria-pressed="true">Furniture</button><button data-collection-tab="presets" aria-pressed="false">Room designs</button></div><div class="builder-meta"><span id="item-count"></span><button class="quiet-button" id="undo-layout" disabled>${icon('reset')} Undo</button></div></div>
          <div class="selection-inspector" id="selection-inspector" aria-live="polite"></div>
          <div id="collection-content"></div>
          <p class="collection-footnote">The whole collection is yours. Pick a piece, then a spot in your room.</p>
          <div class="collection-return-target" id="collection-return-target" aria-hidden="true"><span>${icon('build')}</span><strong id="return-label">Return to your collection</strong><small id="return-detail">Drop here to put this piece away · Undo brings it back</small></div>
        </section>
      </section>
      <section id="house-page" class="house-page" aria-label="Your growing house" hidden></section>
      <aside class="focus-card" id="focus-card" tabindex="-1" aria-labelledby="focus-title">
        <div class="card-top"><span class="eyebrow">A MOMENT FOR YOU</span><span class="tiny-flower" aria-hidden="true">${blossomArt()}</span></div>
        <h2 id="focus-title">Little by <em>little.</em></h2><p class="focus-intro">Make space for one good thing.</p>
        <label class="field-label" for="task">Your little intention</label>
        <input id="task" maxlength="180" placeholder="Read a chapter, dream something up…" autocomplete="off" />
        <div class="timer-area">
          <div class="timer-dial" id="timer-dial">
            <svg class="timer-ring" id="timer-ring" viewBox="0 0 200 200" role="slider" tabindex="0" aria-label="Focus length" aria-valuemin="1" aria-valuemax="120" aria-valuenow="25" aria-valuetext="25 minutes"><circle class="timer-track" cx="100" cy="100" r="91"/><circle class="timer-progress" id="timer-progress" cx="100" cy="100" r="91" pathLength="100"/><circle class="timer-seed" cx="100" cy="9" r="5"/></svg>
            <div class="timer-center"><span id="session-label" class="session-label">SETTLE IN</span><div id="timer" class="timer" role="timer" aria-label="25 minutes remaining">25:00</div><span class="timer-caption" id="timer-caption">a small beginning</span></div>
          </div>
          <div class="durations" role="group" aria-label="Focus duration"><button data-minutes="25" aria-pressed="true">25 <span>min</span></button><button data-minutes="50" aria-pressed="false">50 <span>min</span></button><button data-minutes="90" aria-pressed="false">90 <span>min</span></button></div>
        </div>
        <button class="start-button" id="start-button"><span>Start focusing</span>${icon('arrow')}</button>
        <button class="reset-session" id="reset-session" hidden>Start over</button>
        <div class="sound-row"><button id="sound-button" class="sound-button" aria-pressed="false">${icon('rain')}<span>Soft rain<span class="sound-state" id="sound-state">Sound off</span></span><span class="sound-switch" aria-hidden="true"></span></button><label class="sr-only" for="volume">Rain volume</label><input type="range" id="volume" min="0" max="100" value="${audioPrefs.volume}" aria-label="Rain volume" disabled /><label class="chime-toggle"><span>Chime when a session ends</span><input type="checkbox" id="chime-toggle" ${audioPrefs.chime ? 'checked' : ''} /></label></div>
        <div id="focus-reward" class="focus-reward"></div>
        <details class="session-journal"><summary><span>Today’s little wins</span><span id="today-total">0 min</span></summary><div id="today-sessions"></div></details>
        <div class="daily-note" id="daily-note">Good things begin with a little time.</div>
      </aside>
    </main>
    <footer class="app-footer"><span>A softer place to spend your hours.</span><button class="save-status" id="save-status" data-panel="saves" aria-expanded="false" aria-controls="room-panel"><span id="save-status-text">Saved on this device</span> <span aria-hidden="true">✧</span></button></footer>
  </div>
  <dialog id="session-celebration" class="session-celebration" aria-labelledby="celebration-title" aria-describedby="celebration-copy">
    <form method="dialog"><button class="celebration-close" aria-label="Close session celebration">${icon('close')}</button><div class="celebration-flower" aria-hidden="true"><img src="/ui/little-bloom.png" width="160" height="160" alt="" /></div><p class="eyebrow">LOOK AT YOU GROW</p><h2 id="celebration-title">A little time.<br><em>A lovely little win.</em></h2><p id="celebration-copy"></p><div class="celebration-coins">${coinArt()}<strong id="celebration-earned"></strong><span>for your home</span></div><button class="start-button" autofocus>Enjoy a little break ${icon('heart')}</button><p class="celebration-note">Your room will be right here.</p></form>
  </dialog>
  <div id="drag-return-preview" class="drag-return-preview" aria-hidden="true" hidden></div>
  <div id="toast" class="toast" role="status" hidden></div>`;
