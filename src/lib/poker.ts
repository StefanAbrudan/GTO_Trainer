// Poker utility functions

export const SUIT_SYMBOLS: Record<string, string> = {
  s: "♠",
  h: "♥",
  d: "♦",
  c: "♣",
};

export const SUIT_COLORS: Record<string, string> = {
  s: "text-gray-200",
  h: "text-red-500",
  d: "text-blue-400",
  c: "text-green-400",
};

export function parseCard(card: string): { rank: string; suit: string } {
  return {
    rank: card.slice(0, -1),
    suit: card.slice(-1),
  };
}

export function formatCard(card: string): { rank: string; suitSymbol: string; colorClass: string } {
  const { rank, suit } = parseCard(card);
  return {
    rank: rank.toUpperCase(),
    suitSymbol: SUIT_SYMBOLS[suit] || suit,
    colorClass: SUIT_COLORS[suit] || "text-white",
  };
}

export function formatBoard(board: string[]): { rank: string; suitSymbol: string; colorClass: string }[] {
  return board.map(formatCard);
}

// Calculate simple equity estimates
export function calculatePotOdds(betSize: number, potSize: number): number {
  return betSize / (potSize + betSize + betSize);
}

export function calculateMDF(betSize: number, potSize: number): number {
  return 1 - betSize / (potSize + betSize);
}

export function calculateBluffFrequency(betSize: number, potSize: number): number {
  return betSize / (potSize + betSize + betSize);
}

// EV calculation
export function calculateEV(
  winProb: number,
  winAmount: number,
  loseProb: number,
  loseAmount: number
): number {
  return winProb * winAmount - loseProb * loseAmount;
}

// Geometric bet sizing
export function geometricBetSize(pot: number, stack: number, streets: number): number {
  // Size that gets all-in over N streets
  const ratio = Math.pow((stack + pot) / pot, 1 / streets) - 1;
  return pot * ratio;
}
