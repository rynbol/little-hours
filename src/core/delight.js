export function celebrationWeight(age, reducedMotion = false) {
  if (reducedMotion || age < 0 || age >= 3.2) return 0;
  return Math.min(1, age / .45) * Math.min(1, (3.2 - age) / .8);
}
