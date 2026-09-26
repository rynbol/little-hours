import { AVATAR_OPTIONS, AVATAR_LOOKS } from './avatar.js';

const hairShapes = {
  bun: 'M8 19v-5a8 8 0 0 1 16 0v5c-2-2-5-3-8-3s-6 1-8 3Zm11-11a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z',
  bob: 'M7 18V14a9 9 0 0 1 18 0v12h-4v-9H11v9H7V18Z',
  waves: 'M7 18V14a9 9 0 0 1 18 0v5c-2-2-2-3-4-2s-2 4-4 3-2-4-4-3-2 3-4 2H7Z',
  crop: 'M8 16v-3a8 8 0 0 1 16 0v3c-2-2-4-2-6-1s-4 1-6 0-2-1-4 1Z',
};
const designShapes = {
  outfit: {
    cardigan: '<path class="design-fill" d="m11 5-6 4 4 6v16h18V15l4-6-6-4-4 7h-6z"/><path class="design-accent" d="M16 12v18m3-12h.1m-.1 5h.1m-.1 5h.1"/>',
    hoodie: '<path class="design-fill" d="M11 8a5 5 0 0 1 10 0l6 3 3 5-4 2v13H8V18l-4-2 3-5z"/><path class="design-accent" d="M13 20h6l2 5h-10zm1-10 2 3 2-3"/>',
    overalls: '<path class="design-fill" d="m9 7 4 2h6l4-2 5 4-3 5v15H7V16l-3-5z"/><path class="design-denim" d="M10 8h2v7h8V8h2v23H10Z"/><path class="design-accent" d="M14 18h4v4h-4z"/>',
    sailor: '<path class="design-fill" d="m11 5-6 4 4 6v16h18V15l4-6-6-4-4 7h-6z"/><path class="design-accent" d="m10 11 6 5 6-5m-6 5v14m-4-9h.1"/>',
  },
  bottomStyle: {
    trousers: '<path class="design-fill" d="M9 5h14l2 26h-7l-2-14-2 14H7z"/><path class="design-accent" d="M16 7v9"/>',
    skirt: '<path class="design-fill" d="M10 5h12l5 26H5z"/><path class="design-accent" d="m12 9-2 18m6-18v18m4-18 2 18"/>',
    shorts: '<path class="design-fill" d="M9 5h14l3 16h-8l-2-5-2 5H6z"/><path class="design-accent" d="M16 7v9m-8 5h7m2 0h8"/>',
  },
  accessory: {
    none: '<path class="design-face" d="M8 18a8 8 0 1 1 16 0v4a8 8 0 0 1-16 0z"/><path class="design-accent" d="M25 8h.1"/>',
    glasses: '<path class="design-face" d="M8 18a8 8 0 1 1 16 0v4a8 8 0 0 1-16 0z"/><circle class="design-accent" cx="12" cy="19" r="3.4"/><circle class="design-accent" cx="20" cy="19" r="3.4"/><path class="design-accent" d="M15.4 19h1.2"/>',
    blossom: '<path class="design-face" d="M8 18a8 8 0 1 1 16 0v4a8 8 0 0 1-16 0z"/><path class="design-flower" d="M9 10c-2-3 2-5 4-2 1-4 5-3 5 0 4-2 6 2 3 4 3 2 1 6-3 5-1 4-5 3-5 0-4 2-6-2-3-4-3-1-3-4-1-3Z"/>',
    'moon-clips': '<path class="design-face" d="M8 18a8 8 0 1 1 16 0v4a8 8 0 0 1-16 0z"/><path class="design-star" d="M10 10a4 4 0 1 0 3 6 4 4 0 0 1-3-6Zm13 0a4 4 0 1 0 3 6 4 4 0 0 1-3-6Z"/>',
  },
};
export function avatarEditorContent(avatar, section) {
  if (section === 'looks') return `<div class="avatar-looks-intro"><span class="eyebrow">A LITTLE INSPIRATION</span><p>One look. A hundred little ways to make it yours.</p></div><div class="avatar-look-grid">${AVATAR_LOOKS.map(look => {
    const selected = Object.entries(look.appearance).every(([part, value]) => avatar[part] === value);
    const top = AVATAR_OPTIONS.top.find(x => x.id === look.appearance.top), bottom = AVATAR_OPTIONS.bottom.find(x => x.id === look.appearance.bottom);
    return `<button class="avatar-look" data-avatar-look="${look.id}" aria-pressed="${selected}" style="--look-bg:${look.background}"><span class="look-illustration" aria-hidden="true"><svg viewBox="0 0 36 36" style="--design-tone:${top.color};--design-accent:${top.trim};--denim-tone:${bottom.color}">${designShapes.outfit[look.appearance.outfit]}</svg><span class="look-palette"><i style="background:${top.color}"></i><i style="background:${bottom.color}"></i><i style="background:${top.trim}"></i></span></span><strong>${look.name}</strong><small>${look.description}</small><span class="look-check" aria-hidden="true">✓</span></button>`;
  }).join('')}</div><p class="avatar-look-note">Your face & hair stay just as you made them.</p>`;
  const names = {skin:'Skin tone', hair:'Hair color', style:'Hair style', outfit:'The top', top:'Top color', bottomStyle:'The bottom', bottom:'Bottom color', accessory:'A finishing touch'};
  const parts = section === 'face' ? ['style', 'hair', 'skin'] : section === 'outfit' ? ['outfit', 'top', 'bottomStyle', 'bottom'] : ['accessory'];
  const hair = AVATAR_OPTIONS.hair.find(x => x.id === avatar.hair).color, skin = AVATAR_OPTIONS.skin.find(x => x.id === avatar.skin).color;
  const top = AVATAR_OPTIONS.top.find(x => x.id === avatar.top), bottom = AVATAR_OPTIONS.bottom.find(x => x.id === avatar.bottom);
  return parts.map(part => {
    const options = AVATAR_OPTIONS[part], design = part === 'style' || Boolean(designShapes[part]);
    const preview = option => {
      if (part === 'style') return `<svg class="avatar-hair-preview" viewBox="0 0 32 32" aria-hidden="true" style="--hair-tone:${hair};--skin-tone:${skin}"><ellipse cx="16" cy="19" rx="8" ry="10"/><path d="${hairShapes[option.id]}"/></svg>`;
      if (designShapes[part]) return `<svg class="avatar-design-preview" viewBox="0 0 36 36" aria-hidden="true" style="--design-tone:${part === 'bottomStyle' ? bottom.color : top.color};--design-accent:${part === 'bottomStyle' ? bottom.trim : top.trim};--skin-tone:${skin};--denim-tone:${bottom.color}">${designShapes[part][option.id]}</svg>`;
      return `<span class="avatar-color" style="--avatar-color:${option.color}"><span aria-hidden="true">✓</span></span>`;
    };
    return `<fieldset class="avatar-choice"><legend>${names[part]}<span>${options.find(x => x.id === avatar[part]).name}</span></legend><div class="avatar-swatches ${design ? 'avatar-designs' : ''}" style="--avatar-count:${options.length}" role="group" aria-label="${names[part]}">${options.map(option => `<button class="avatar-swatch ${design ? 'avatar-design-choice' : ''}" data-avatar-part="${part}" data-avatar-value="${option.id}" aria-pressed="${avatar[part] === option.id}" aria-label="${option.name}" title="${option.name}">${preview(option)}<span class="avatar-option-name">${option.name}</span></button>`).join('')}</div></fieldset>`;
  }).join('') + (section === 'details' ? '<div class="avatar-details-note"><span aria-hidden="true">✧</span><p>It’s the little things<br>that feel like you.</p></div>' : '');
}
