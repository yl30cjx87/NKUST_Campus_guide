export function shuffleSpots<T>(spots: readonly T[]) {
  const shuffled = [...spots];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function shuffleNames<T extends { name: string }>(spots: readonly T[]) {
  const names = shuffleSpots(spots).map((spot) => spot.name);
  const originalOrder = spots.map((spot) => spot.name);
  if (names.length > 1 && names.every((name, index) => name === originalOrder[index])) {
    [names[0], names[1]] = [names[1], names[0]];
  }
  return names;
}

export const shuffleChoiceNames = shuffleNames;

export function sampleArtSpots<T>(spots: readonly T[], count = 4) {
  return shuffleSpots(spots).slice(0, Math.min(count, spots.length));
}
