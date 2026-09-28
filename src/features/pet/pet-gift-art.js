export function petGiftArt(id) {
  const art = id === 'daisy'
    ? '<ellipse cx="40" cy="68" rx="21" ry="4" fill="#6d504012"/><path d="M28 47q12-5 24 0l-3 18q-9 5-18 0z" fill="#b7b7cb"/><path d="M31 48q9 3 18 0" fill="none" stroke="#9498b1" stroke-width="3"/><path d="M40 48V22m0 17-11-7m11 1 9-7" fill="none" stroke="#8c9b76" stroke-width="2.8" stroke-linecap="round"/><g fill="#f0ddb0"><ellipse cx="40" cy="20" rx="14" ry="5"/><ellipse cx="40" cy="20" rx="5" ry="14"/><ellipse cx="40" cy="20" rx="5" ry="14" transform="rotate(45 40 20)"/><ellipse cx="40" cy="20" rx="5" ry="14" transform="rotate(-45 40 20)"/></g><circle cx="40" cy="20" r="5" fill="#c39b55"/>'
    : id === 'star'
      ? '<ellipse cx="40" cy="68" rx="21" ry="4" fill="#6d504012"/><path d="M40 47v16" stroke="#b68d59" stroke-width="3"/><ellipse cx="40" cy="65" rx="15" ry="4" fill="#c9a386"/><path d="m40 9 8 17 19 3-14 14 3 20-16-10-16 10 3-20-14-14 19-3z" fill="#dbafb1"/><path d="m40 9 0 29 27-9-14 14-13-5-16 25 3-20 13-5-8-12z" fill="#edc7c2"/><path d="m40 38 16 25-3-20z" fill="#be8b98"/>'
      : '<ellipse cx="40" cy="68" rx="25" ry="5" fill="#6d504012"/><ellipse cx="40" cy="65" rx="23" ry="6" fill="#b4a5bc"/><path d="M51 10C16 5 7 50 35 60c13 5 24-2 28-9-30 6-36-27-12-41" fill="#ecd095"/><path d="M47 15C25 17 20 44 39 54" fill="none" stroke="#fff0c8" stroke-width="3" stroke-linecap="round"/>';
  return `<svg viewBox="0 0 80 80" aria-hidden="true">${art}</svg>`;
}
