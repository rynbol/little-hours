export const AVATAR_DEFAULT = Object.freeze({
  skin: 'warm', hair: 'chestnut', top: 'clay', bottom: 'sage', style: 'bun',
  outfit: 'cardigan', bottomStyle: 'trousers', accessory: 'none',
});

export const AVATAR_OPTIONS = Object.freeze({
  skin: [
    { id: 'porcelain', name: 'Porcelain', color: '#f1d4b1' },
    { id: 'warm', name: 'Warm honey', color: '#d6ad87' },
    { id: 'golden', name: 'Golden tan', color: '#bd875f' },
    { id: 'cocoa', name: 'Cocoa', color: '#956247' },
    { id: 'deep', name: 'Deep umber', color: '#68432f' },
  ],
  hair: [
    { id: 'chestnut', name: 'Chestnut', color: '#674d3b' },
    { id: 'espresso', name: 'Espresso', color: '#382b28' },
    { id: 'copper', name: 'Copper', color: '#a65336' },
    { id: 'honey', name: 'Honey blonde', color: '#c49a52' },
    { id: 'silver', name: 'Moon silver', color: '#b1a99b' },
  ],
  top: [
    { id: 'clay', name: 'Terracotta', color: '#b88770', shade: '#a67863', trim: '#cb9b7d' },
    { id: 'rose', name: 'Rose', color: '#bd8290', shade: '#a66d7b', trim: '#d7a0aa' },
    { id: 'sage', name: 'Sage', color: '#879b82', shade: '#6f846e', trim: '#a8b69e' },
    { id: 'butter', name: 'Buttercream', color: '#d0ad69', shade: '#b49255', trim: '#e0c58d' },
    { id: 'lavender', name: 'Lavender', color: '#9181a6', shade: '#77698b', trim: '#b4a6c4' },
    { id: 'sky', name: 'Bluebell', color: '#718da0', shade: '#5b7587', trim: '#a0b8c3' },
  ],
  bottom: [
    { id: 'sage', name: 'Sage', color: '#777e72', trim: '#a4ac94' },
    { id: 'walnut', name: 'Walnut', color: '#765743', trim: '#aa8769' },
    { id: 'midnight', name: 'Midnight', color: '#46546b', trim: '#8795a5' },
    { id: 'plum', name: 'Mulberry', color: '#76576f', trim: '#a78ca7' },
    { id: 'cream', name: 'Oat milk', color: '#c2ad8d', trim: '#f0dfc0' },
  ],
  style: [
    { id: 'bun', name: 'Soft bun' },
    { id: 'bob', name: 'Little bob' },
    { id: 'waves', name: 'Loose waves' },
    { id: 'crop', name: 'Short crop' },
  ],
  outfit: [
    { id: 'cardigan', name: 'Keepsake cardigan' },
    { id: 'hoodie', name: 'Cloud hoodie' },
    { id: 'overalls', name: 'Studio overalls' },
    { id: 'sailor', name: 'Sailor collar' },
  ],
  bottomStyle: [
    { id: 'trousers', name: 'Soft trousers' },
    { id: 'skirt', name: 'Pleated skirt' },
    { id: 'shorts', name: 'Cuffed shorts' },
  ],
  accessory: [
    { id: 'none', name: 'No extra' },
    { id: 'glasses', name: 'Round glasses' },
    { id: 'blossom', name: 'Blossom clip' },
    { id: 'moon-clips', name: 'Moon clips' },
  ],
});

export function normalizeAvatarAppearance(value = {}) {
  return Object.fromEntries(Object.entries(AVATAR_DEFAULT).map(([part, fallback]) => {
    const id = value?.[part];
    return [part, AVATAR_OPTIONS[part].some(option => option.id === id) ? id : fallback];
  }));
}

export function avatarPaint(appearance, part) {
  const selected = normalizeAvatarAppearance(appearance)[part];
  return AVATAR_OPTIONS[part].find(option => option.id === selected);
}

export function avatarAppearanceKey(appearance) {
  return Object.values(normalizeAvatarAppearance(appearance)).join(':');
}
