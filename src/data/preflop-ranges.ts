// GTO preflop opening ranges by position (6-max, 100bb)
// Values represent open-raise frequency (0-100)
// Based on standard GTO solver outputs

export const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
export type Rank = (typeof RANKS)[number];

export interface RangeData {
  position: string;
  action: string;
  scenario: string;
  grid: Record<string, number>; // "AKs" -> 100, "AKo" -> 85, "AA" -> 100
}

// Helper to generate hand notation
export function getHandKey(row: number, col: number): string {
  const r1 = RANKS[row];
  const r2 = RANKS[col];
  if (row === col) return `${r1}${r2}`; // pocket pair
  if (row < col) return `${r1}${r2}s`; // suited (above diagonal)
  return `${r2}${r1}o`; // offsuit (below diagonal)
}

export function getHandDisplay(row: number, col: number): string {
  return getHandKey(row, col);
}

export function isSuited(row: number, col: number): boolean {
  return row < col;
}

export function isPair(row: number, col: number): boolean {
  return row === col;
}

// Color coding for range visualization
export function getFrequencyColor(freq: number): string {
  if (freq === 0) return "bg-gray-800";
  if (freq <= 20) return "bg-red-900/70";
  if (freq <= 40) return "bg-red-700/70";
  if (freq <= 60) return "bg-yellow-700/70";
  if (freq <= 80) return "bg-green-700/70";
  return "bg-green-500/80";
}

export function getFrequencyTextColor(freq: number): string {
  if (freq === 0) return "text-gray-600";
  if (freq <= 40) return "text-red-300";
  if (freq <= 60) return "text-yellow-300";
  return "text-green-300";
}

// UTG (Under the Gun) - Tightest opening range ~15%
const UTG_RFI: Record<string, number> = {
  // Pairs
  AA: 100, KK: 100, QQ: 100, JJ: 100, TT: 100, "99": 100, "88": 80, "77": 60, "66": 30, "55": 20, "44": 0, "33": 0, "22": 0,
  // Suited hands
  AKs: 100, AQs: 100, AJs: 100, ATs: 100, A9s: 50, A8s: 30, A7s: 20, A6s: 20, A5s: 50, A4s: 40, A3s: 20, A2s: 15,
  KQs: 100, KJs: 100, KTs: 80, K9s: 20, K8s: 0, K7s: 0, K6s: 0, K5s: 0, K4s: 0, K3s: 0, K2s: 0,
  QJs: 100, QTs: 70, Q9s: 15, Q8s: 0, Q7s: 0, Q6s: 0, Q5s: 0, Q4s: 0, Q3s: 0, Q2s: 0,
  JTs: 100, J9s: 30, J8s: 0, J7s: 0, J6s: 0, J5s: 0, J4s: 0, J3s: 0, J2s: 0,
  T9s: 60, T8s: 15, T7s: 0, T6s: 0, T5s: 0, T4s: 0, T3s: 0, T2s: 0,
  "98s": 30, "97s": 0, "96s": 0, "95s": 0, "94s": 0, "93s": 0, "92s": 0,
  "87s": 15, "86s": 0, "85s": 0, "84s": 0, "83s": 0, "82s": 0,
  "76s": 10, "75s": 0, "74s": 0, "73s": 0, "72s": 0,
  "65s": 10, "64s": 0, "63s": 0, "62s": 0,
  "54s": 0, "53s": 0, "52s": 0,
  "43s": 0, "42s": 0,
  "32s": 0,
  // Offsuit hands
  AKo: 100, AQo: 100, AJo: 100, ATo: 70, A9o: 0, A8o: 0, A7o: 0, A6o: 0, A5o: 0, A4o: 0, A3o: 0, A2o: 0,
  KQo: 80, KJo: 40, KTo: 0, K9o: 0, K8o: 0, K7o: 0, K6o: 0, K5o: 0, K4o: 0, K3o: 0, K2o: 0,
  QJo: 20, QTo: 0, Q9o: 0, Q8o: 0, Q7o: 0, Q6o: 0, Q5o: 0, Q4o: 0, Q3o: 0, Q2o: 0,
  JTo: 0, J9o: 0, J8o: 0, J7o: 0, J6o: 0, J5o: 0, J4o: 0, J3o: 0, J2o: 0,
  T9o: 0, T8o: 0, T7o: 0, T6o: 0, T5o: 0, T4o: 0, T3o: 0, T2o: 0,
  "98o": 0, "97o": 0, "96o": 0, "95o": 0, "94o": 0, "93o": 0, "92o": 0,
  "87o": 0, "86o": 0, "85o": 0, "84o": 0, "83o": 0, "82o": 0,
  "76o": 0, "75o": 0, "74o": 0, "73o": 0, "72o": 0,
  "65o": 0, "64o": 0, "63o": 0, "62o": 0,
  "54o": 0, "53o": 0, "52o": 0,
  "43o": 0, "42o": 0,
  "32o": 0,
};

// HJ (Hijack) - Slightly wider ~19%
const HJ_RFI: Record<string, number> = {
  AA: 100, KK: 100, QQ: 100, JJ: 100, TT: 100, "99": 100, "88": 100, "77": 80, "66": 60, "55": 50, "44": 30, "33": 15, "22": 10,
  AKs: 100, AQs: 100, AJs: 100, ATs: 100, A9s: 80, A8s: 60, A7s: 50, A6s: 40, A5s: 80, A4s: 70, A3s: 50, A2s: 40,
  KQs: 100, KJs: 100, KTs: 100, K9s: 50, K8s: 15, K7s: 10, K6s: 10, K5s: 0, K4s: 0, K3s: 0, K2s: 0,
  QJs: 100, QTs: 100, Q9s: 40, Q8s: 10, Q7s: 0, Q6s: 0, Q5s: 0, Q4s: 0, Q3s: 0, Q2s: 0,
  JTs: 100, J9s: 60, J8s: 15, J7s: 0, J6s: 0, J5s: 0, J4s: 0, J3s: 0, J2s: 0,
  T9s: 90, T8s: 40, T7s: 10, T6s: 0, T5s: 0, T4s: 0, T3s: 0, T2s: 0,
  "98s": 70, "97s": 15, "96s": 0, "95s": 0, "94s": 0, "93s": 0, "92s": 0,
  "87s": 50, "86s": 10, "85s": 0, "84s": 0, "83s": 0, "82s": 0,
  "76s": 40, "75s": 10, "74s": 0, "73s": 0, "72s": 0,
  "65s": 30, "64s": 0, "63s": 0, "62s": 0,
  "54s": 20, "53s": 0, "52s": 0,
  "43s": 0, "42s": 0,
  "32s": 0,
  AKo: 100, AQo: 100, AJo: 100, ATo: 90, A9o: 20, A8o: 0, A7o: 0, A6o: 0, A5o: 0, A4o: 0, A3o: 0, A2o: 0,
  KQo: 100, KJo: 70, KTo: 30, K9o: 0, K8o: 0, K7o: 0, K6o: 0, K5o: 0, K4o: 0, K3o: 0, K2o: 0,
  QJo: 50, QTo: 15, Q9o: 0, Q8o: 0, Q7o: 0, Q6o: 0, Q5o: 0, Q4o: 0, Q3o: 0, Q2o: 0,
  JTo: 15, J9o: 0, J8o: 0, J7o: 0, J6o: 0, J5o: 0, J4o: 0, J3o: 0, J2o: 0,
  T9o: 0, T8o: 0, T7o: 0, T6o: 0, T5o: 0, T4o: 0, T3o: 0, T2o: 0,
  "98o": 0, "97o": 0, "96o": 0, "95o": 0, "94o": 0, "93o": 0, "92o": 0,
  "87o": 0, "86o": 0, "85o": 0, "84o": 0, "83o": 0, "82o": 0,
  "76o": 0, "75o": 0, "74o": 0, "73o": 0, "72o": 0,
  "65o": 0, "64o": 0, "63o": 0, "62o": 0,
  "54o": 0, "53o": 0, "52o": 0,
  "43o": 0, "42o": 0,
  "32o": 0,
};

// CO (Cutoff) - ~25%
const CO_RFI: Record<string, number> = {
  AA: 100, KK: 100, QQ: 100, JJ: 100, TT: 100, "99": 100, "88": 100, "77": 100, "66": 90, "55": 80, "44": 70, "33": 50, "22": 40,
  AKs: 100, AQs: 100, AJs: 100, ATs: 100, A9s: 100, A8s: 90, A7s: 80, A6s: 70, A5s: 100, A4s: 90, A3s: 80, A2s: 70,
  KQs: 100, KJs: 100, KTs: 100, K9s: 80, K8s: 50, K7s: 30, K6s: 25, K5s: 20, K4s: 15, K3s: 10, K2s: 10,
  QJs: 100, QTs: 100, Q9s: 80, Q8s: 30, Q7s: 15, Q6s: 10, Q5s: 10, Q4s: 0, Q3s: 0, Q2s: 0,
  JTs: 100, J9s: 90, J8s: 40, J7s: 15, J6s: 0, J5s: 0, J4s: 0, J3s: 0, J2s: 0,
  T9s: 100, T8s: 70, T7s: 25, T6s: 10, T5s: 0, T4s: 0, T3s: 0, T2s: 0,
  "98s": 100, "97s": 40, "96s": 15, "95s": 0, "94s": 0, "93s": 0, "92s": 0,
  "87s": 90, "86s": 30, "85s": 10, "84s": 0, "83s": 0, "82s": 0,
  "76s": 80, "75s": 25, "74s": 0, "73s": 0, "72s": 0,
  "65s": 70, "64s": 15, "63s": 0, "62s": 0,
  "54s": 60, "53s": 10, "52s": 0,
  "43s": 10, "42s": 0,
  "32s": 0,
  AKo: 100, AQo: 100, AJo: 100, ATo: 100, A9o: 60, A8o: 30, A7o: 15, A6o: 10, A5o: 20, A4o: 10, A3o: 10, A2o: 5,
  KQo: 100, KJo: 100, KTo: 70, K9o: 20, K8o: 0, K7o: 0, K6o: 0, K5o: 0, K4o: 0, K3o: 0, K2o: 0,
  QJo: 90, QTo: 50, Q9o: 10, Q8o: 0, Q7o: 0, Q6o: 0, Q5o: 0, Q4o: 0, Q3o: 0, Q2o: 0,
  JTo: 50, J9o: 10, J8o: 0, J7o: 0, J6o: 0, J5o: 0, J4o: 0, J3o: 0, J2o: 0,
  T9o: 15, T8o: 0, T7o: 0, T6o: 0, T5o: 0, T4o: 0, T3o: 0, T2o: 0,
  "98o": 0, "97o": 0, "96o": 0, "95o": 0, "94o": 0, "93o": 0, "92o": 0,
  "87o": 0, "86o": 0, "85o": 0, "84o": 0, "83o": 0, "82o": 0,
  "76o": 0, "75o": 0, "74o": 0, "73o": 0, "72o": 0,
  "65o": 0, "64o": 0, "63o": 0, "62o": 0,
  "54o": 0, "53o": 0, "52o": 0,
  "43o": 0, "42o": 0,
  "32o": 0,
};

// BTN (Button) - Widest opening ~45%
const BTN_RFI: Record<string, number> = {
  AA: 100, KK: 100, QQ: 100, JJ: 100, TT: 100, "99": 100, "88": 100, "77": 100, "66": 100, "55": 100, "44": 100, "33": 90, "22": 80,
  AKs: 100, AQs: 100, AJs: 100, ATs: 100, A9s: 100, A8s: 100, A7s: 100, A6s: 100, A5s: 100, A4s: 100, A3s: 100, A2s: 100,
  KQs: 100, KJs: 100, KTs: 100, K9s: 100, K8s: 90, K7s: 80, K6s: 70, K5s: 60, K4s: 50, K3s: 40, K2s: 35,
  QJs: 100, QTs: 100, Q9s: 100, Q8s: 80, Q7s: 50, Q6s: 40, Q5s: 35, Q4s: 30, Q3s: 20, Q2s: 15,
  JTs: 100, J9s: 100, J8s: 80, J7s: 50, J6s: 25, J5s: 15, J4s: 10, J3s: 0, J2s: 0,
  T9s: 100, T8s: 100, T7s: 60, T6s: 35, T5s: 15, T4s: 0, T3s: 0, T2s: 0,
  "98s": 100, "97s": 80, "96s": 40, "95s": 15, "94s": 0, "93s": 0, "92s": 0,
  "87s": 100, "86s": 70, "85s": 30, "84s": 10, "83s": 0, "82s": 0,
  "76s": 100, "75s": 60, "74s": 20, "73s": 0, "72s": 0,
  "65s": 100, "64s": 50, "63s": 15, "62s": 0,
  "54s": 100, "53s": 40, "52s": 10,
  "43s": 40, "42s": 10,
  "32s": 15,
  AKo: 100, AQo: 100, AJo: 100, ATo: 100, A9o: 100, A8o: 80, A7o: 70, A6o: 60, A5o: 80, A4o: 60, A3o: 50, A2o: 40,
  KQo: 100, KJo: 100, KTo: 100, K9o: 70, K8o: 30, K7o: 15, K6o: 10, K5o: 0, K4o: 0, K3o: 0, K2o: 0,
  QJo: 100, QTo: 90, Q9o: 50, Q8o: 15, Q7o: 0, Q6o: 0, Q5o: 0, Q4o: 0, Q3o: 0, Q2o: 0,
  JTo: 100, J9o: 50, J8o: 15, J7o: 0, J6o: 0, J5o: 0, J4o: 0, J3o: 0, J2o: 0,
  T9o: 70, T8o: 20, T7o: 0, T6o: 0, T5o: 0, T4o: 0, T3o: 0, T2o: 0,
  "98o": 40, "97o": 10, "96o": 0, "95o": 0, "94o": 0, "93o": 0, "92o": 0,
  "87o": 25, "86o": 0, "85o": 0, "84o": 0, "83o": 0, "82o": 0,
  "76o": 15, "75o": 0, "74o": 0, "73o": 0, "72o": 0,
  "65o": 10, "64o": 0, "63o": 0, "62o": 0,
  "54o": 0, "53o": 0, "52o": 0,
  "43o": 0, "42o": 0,
  "32o": 0,
};

// SB (Small Blind) - Opens wide but 3-bets more in modern GTO ~40%
const SB_RFI: Record<string, number> = {
  AA: 100, KK: 100, QQ: 100, JJ: 100, TT: 100, "99": 100, "88": 100, "77": 100, "66": 90, "55": 80, "44": 70, "33": 60, "22": 50,
  AKs: 100, AQs: 100, AJs: 100, ATs: 100, A9s: 100, A8s: 100, A7s: 90, A6s: 80, A5s: 100, A4s: 90, A3s: 80, A2s: 70,
  KQs: 100, KJs: 100, KTs: 100, K9s: 90, K8s: 70, K7s: 50, K6s: 40, K5s: 35, K4s: 30, K3s: 25, K2s: 20,
  QJs: 100, QTs: 100, Q9s: 90, Q8s: 60, Q7s: 35, Q6s: 25, Q5s: 20, Q4s: 15, Q3s: 10, Q2s: 10,
  JTs: 100, J9s: 100, J8s: 60, J7s: 30, J6s: 15, J5s: 10, J4s: 0, J3s: 0, J2s: 0,
  T9s: 100, T8s: 90, T7s: 40, T6s: 20, T5s: 0, T4s: 0, T3s: 0, T2s: 0,
  "98s": 100, "97s": 60, "96s": 25, "95s": 0, "94s": 0, "93s": 0, "92s": 0,
  "87s": 100, "86s": 50, "85s": 15, "84s": 0, "83s": 0, "82s": 0,
  "76s": 90, "75s": 40, "74s": 10, "73s": 0, "72s": 0,
  "65s": 80, "64s": 30, "63s": 10, "62s": 0,
  "54s": 70, "53s": 25, "52s": 0,
  "43s": 25, "42s": 0,
  "32s": 10,
  AKo: 100, AQo: 100, AJo: 100, ATo: 100, A9o: 80, A8o: 60, A7o: 40, A6o: 30, A5o: 50, A4o: 35, A3o: 25, A2o: 20,
  KQo: 100, KJo: 100, KTo: 80, K9o: 40, K8o: 15, K7o: 0, K6o: 0, K5o: 0, K4o: 0, K3o: 0, K2o: 0,
  QJo: 90, QTo: 60, Q9o: 25, Q8o: 0, Q7o: 0, Q6o: 0, Q5o: 0, Q4o: 0, Q3o: 0, Q2o: 0,
  JTo: 70, J9o: 25, J8o: 0, J7o: 0, J6o: 0, J5o: 0, J4o: 0, J3o: 0, J2o: 0,
  T9o: 40, T8o: 10, T7o: 0, T6o: 0, T5o: 0, T4o: 0, T3o: 0, T2o: 0,
  "98o": 15, "97o": 0, "96o": 0, "95o": 0, "94o": 0, "93o": 0, "92o": 0,
  "87o": 10, "86o": 0, "85o": 0, "84o": 0, "83o": 0, "82o": 0,
  "76o": 0, "75o": 0, "74o": 0, "73o": 0, "72o": 0,
  "65o": 0, "64o": 0, "63o": 0, "62o": 0,
  "54o": 0, "53o": 0, "52o": 0,
  "43o": 0, "42o": 0,
  "32o": 0,
};

export const PREFLOP_RANGES: RangeData[] = [
  { position: "UTG", action: "Open Raise", scenario: "6-Max, 100bb, First to Act", grid: UTG_RFI },
  { position: "HJ", action: "Open Raise", scenario: "6-Max, 100bb, Folded to HJ", grid: HJ_RFI },
  { position: "CO", action: "Open Raise", scenario: "6-Max, 100bb, Folded to CO", grid: CO_RFI },
  { position: "BTN", action: "Open Raise", scenario: "6-Max, 100bb, Folded to BTN", grid: BTN_RFI },
  { position: "SB", action: "Open Raise", scenario: "6-Max, 100bb, Folded to SB", grid: SB_RFI },
];

// 3-Bet ranges (vs specific positions)
const BTN_3BET_VS_CO: Record<string, number> = {
  AA: 100, KK: 100, QQ: 100, JJ: 100, TT: 70, "99": 30, "88": 15, "77": 10, "66": 0, "55": 0, "44": 0, "33": 0, "22": 0,
  AKs: 100, AQs: 100, AJs: 100, ATs: 60, A9s: 30, A8s: 15, A7s: 10, A6s: 10, A5s: 70, A4s: 50, A3s: 30, A2s: 20,
  KQs: 100, KJs: 60, KTs: 30, K9s: 10, K8s: 0, K7s: 0, K6s: 0, K5s: 0, K4s: 0, K3s: 0, K2s: 0,
  QJs: 50, QTs: 20, Q9s: 10, Q8s: 0, Q7s: 0, Q6s: 0, Q5s: 0, Q4s: 0, Q3s: 0, Q2s: 0,
  JTs: 30, J9s: 10, J8s: 0, J7s: 0, J6s: 0, J5s: 0, J4s: 0, J3s: 0, J2s: 0,
  T9s: 15, T8s: 0, T7s: 0, T6s: 0, T5s: 0, T4s: 0, T3s: 0, T2s: 0,
  "98s": 10, "97s": 0, "96s": 0, "95s": 0, "94s": 0, "93s": 0, "92s": 0,
  "87s": 0, "86s": 0, "85s": 0, "84s": 0, "83s": 0, "82s": 0,
  "76s": 0, "75s": 0, "74s": 0, "73s": 0, "72s": 0,
  "65s": 0, "64s": 0, "63s": 0, "62s": 0,
  "54s": 10, "53s": 0, "52s": 0,
  "43s": 0, "42s": 0,
  "32s": 0,
  AKo: 100, AQo: 80, AJo: 40, ATo: 10, A9o: 0, A8o: 0, A7o: 0, A6o: 0, A5o: 15, A4o: 0, A3o: 0, A2o: 0,
  KQo: 40, KJo: 15, KTo: 0, K9o: 0, K8o: 0, K7o: 0, K6o: 0, K5o: 0, K4o: 0, K3o: 0, K2o: 0,
  QJo: 10, QTo: 0, Q9o: 0, Q8o: 0, Q7o: 0, Q6o: 0, Q5o: 0, Q4o: 0, Q3o: 0, Q2o: 0,
  JTo: 0, J9o: 0, J8o: 0, J7o: 0, J6o: 0, J5o: 0, J4o: 0, J3o: 0, J2o: 0,
  T9o: 0, T8o: 0, T7o: 0, T6o: 0, T5o: 0, T4o: 0, T3o: 0, T2o: 0,
  "98o": 0, "97o": 0, "96o": 0, "95o": 0, "94o": 0, "93o": 0, "92o": 0,
  "87o": 0, "86o": 0, "85o": 0, "84o": 0, "83o": 0, "82o": 0,
  "76o": 0, "75o": 0, "74o": 0, "73o": 0, "72o": 0,
  "65o": 0, "64o": 0, "63o": 0, "62o": 0,
  "54o": 0, "53o": 0, "52o": 0,
  "43o": 0, "42o": 0,
  "32o": 0,
};

// CO 3-bet vs HJ open
const CO_3BET_VS_HJ: Record<string, number> = {
  AA: 100, KK: 100, QQ: 100, JJ: 100, TT: 60, "99": 25, "88": 10, "77": 0, "66": 0, "55": 0, "44": 0, "33": 0, "22": 0,
  AKs: 100, AQs: 100, AJs: 90, ATs: 40, A9s: 20, A8s: 10, A7s: 0, A6s: 0, A5s: 60, A4s: 40, A3s: 20, A2s: 10,
  KQs: 90, KJs: 40, KTs: 15, K9s: 0, K8s: 0, K7s: 0, K6s: 0, K5s: 0, K4s: 0, K3s: 0, K2s: 0,
  QJs: 30, QTs: 10, Q9s: 0, Q8s: 0, Q7s: 0, Q6s: 0, Q5s: 0, Q4s: 0, Q3s: 0, Q2s: 0,
  JTs: 15, J9s: 0, J8s: 0, J7s: 0, J6s: 0, J5s: 0, J4s: 0, J3s: 0, J2s: 0,
  T9s: 10, T8s: 0, T7s: 0, T6s: 0, T5s: 0, T4s: 0, T3s: 0, T2s: 0,
  "98s": 0, "97s": 0, "96s": 0, "95s": 0, "94s": 0, "93s": 0, "92s": 0,
  "87s": 0, "86s": 0, "85s": 0, "84s": 0, "83s": 0, "82s": 0,
  "76s": 0, "75s": 0, "74s": 0, "73s": 0, "72s": 0,
  "65s": 0, "64s": 0, "63s": 0, "62s": 0,
  "54s": 0, "53s": 0, "52s": 0,
  "43s": 0, "42s": 0,
  "32s": 0,
  AKo: 100, AQo: 70, AJo: 25, ATo: 0, A9o: 0, A8o: 0, A7o: 0, A6o: 0, A5o: 10, A4o: 0, A3o: 0, A2o: 0,
  KQo: 30, KJo: 10, KTo: 0, K9o: 0, K8o: 0, K7o: 0, K6o: 0, K5o: 0, K4o: 0, K3o: 0, K2o: 0,
  QJo: 0, QTo: 0, Q9o: 0, Q8o: 0, Q7o: 0, Q6o: 0, Q5o: 0, Q4o: 0, Q3o: 0, Q2o: 0,
  JTo: 0, J9o: 0, J8o: 0, J7o: 0, J6o: 0, J5o: 0, J4o: 0, J3o: 0, J2o: 0,
  T9o: 0, T8o: 0, T7o: 0, T6o: 0, T5o: 0, T4o: 0, T3o: 0, T2o: 0,
  "98o": 0, "97o": 0, "96o": 0, "95o": 0, "94o": 0, "93o": 0, "92o": 0,
  "87o": 0, "86o": 0, "85o": 0, "84o": 0, "83o": 0, "82o": 0,
  "76o": 0, "75o": 0, "74o": 0, "73o": 0, "72o": 0,
  "65o": 0, "64o": 0, "63o": 0, "62o": 0,
  "54o": 0, "53o": 0, "52o": 0,
  "43o": 0, "42o": 0,
  "32o": 0,
};

// SB 3-bet vs BTN open
const SB_3BET_VS_BTN: Record<string, number> = {
  AA: 100, KK: 100, QQ: 100, JJ: 100, TT: 80, "99": 50, "88": 25, "77": 15, "66": 10, "55": 10, "44": 0, "33": 0, "22": 0,
  AKs: 100, AQs: 100, AJs: 100, ATs: 80, A9s: 50, A8s: 30, A7s: 20, A6s: 15, A5s: 80, A4s: 60, A3s: 40, A2s: 30,
  KQs: 100, KJs: 80, KTs: 50, K9s: 20, K8s: 10, K7s: 0, K6s: 0, K5s: 0, K4s: 0, K3s: 0, K2s: 0,
  QJs: 70, QTs: 35, Q9s: 15, Q8s: 0, Q7s: 0, Q6s: 0, Q5s: 0, Q4s: 0, Q3s: 0, Q2s: 0,
  JTs: 50, J9s: 15, J8s: 0, J7s: 0, J6s: 0, J5s: 0, J4s: 0, J3s: 0, J2s: 0,
  T9s: 25, T8s: 10, T7s: 0, T6s: 0, T5s: 0, T4s: 0, T3s: 0, T2s: 0,
  "98s": 15, "97s": 0, "96s": 0, "95s": 0, "94s": 0, "93s": 0, "92s": 0,
  "87s": 10, "86s": 0, "85s": 0, "84s": 0, "83s": 0, "82s": 0,
  "76s": 10, "75s": 0, "74s": 0, "73s": 0, "72s": 0,
  "65s": 10, "64s": 0, "63s": 0, "62s": 0,
  "54s": 10, "53s": 0, "52s": 0,
  "43s": 0, "42s": 0,
  "32s": 0,
  AKo: 100, AQo: 100, AJo: 60, ATo: 25, A9o: 10, A8o: 0, A7o: 0, A6o: 0, A5o: 20, A4o: 10, A3o: 0, A2o: 0,
  KQo: 60, KJo: 25, KTo: 10, K9o: 0, K8o: 0, K7o: 0, K6o: 0, K5o: 0, K4o: 0, K3o: 0, K2o: 0,
  QJo: 15, QTo: 0, Q9o: 0, Q8o: 0, Q7o: 0, Q6o: 0, Q5o: 0, Q4o: 0, Q3o: 0, Q2o: 0,
  JTo: 0, J9o: 0, J8o: 0, J7o: 0, J6o: 0, J5o: 0, J4o: 0, J3o: 0, J2o: 0,
  T9o: 0, T8o: 0, T7o: 0, T6o: 0, T5o: 0, T4o: 0, T3o: 0, T2o: 0,
  "98o": 0, "97o": 0, "96o": 0, "95o": 0, "94o": 0, "93o": 0, "92o": 0,
  "87o": 0, "86o": 0, "85o": 0, "84o": 0, "83o": 0, "82o": 0,
  "76o": 0, "75o": 0, "74o": 0, "73o": 0, "72o": 0,
  "65o": 0, "64o": 0, "63o": 0, "62o": 0,
  "54o": 0, "53o": 0, "52o": 0,
  "43o": 0, "42o": 0,
  "32o": 0,
};

// BB 3-bet vs SB open
const BB_3BET_VS_SB: Record<string, number> = {
  AA: 100, KK: 100, QQ: 100, JJ: 100, TT: 70, "99": 40, "88": 20, "77": 10, "66": 0, "55": 0, "44": 0, "33": 0, "22": 0,
  AKs: 100, AQs: 100, AJs: 100, ATs: 70, A9s: 40, A8s: 20, A7s: 15, A6s: 10, A5s: 70, A4s: 50, A3s: 30, A2s: 20,
  KQs: 100, KJs: 70, KTs: 40, K9s: 15, K8s: 0, K7s: 0, K6s: 0, K5s: 0, K4s: 0, K3s: 0, K2s: 0,
  QJs: 60, QTs: 25, Q9s: 10, Q8s: 0, Q7s: 0, Q6s: 0, Q5s: 0, Q4s: 0, Q3s: 0, Q2s: 0,
  JTs: 40, J9s: 10, J8s: 0, J7s: 0, J6s: 0, J5s: 0, J4s: 0, J3s: 0, J2s: 0,
  T9s: 20, T8s: 0, T7s: 0, T6s: 0, T5s: 0, T4s: 0, T3s: 0, T2s: 0,
  "98s": 10, "97s": 0, "96s": 0, "95s": 0, "94s": 0, "93s": 0, "92s": 0,
  "87s": 0, "86s": 0, "85s": 0, "84s": 0, "83s": 0, "82s": 0,
  "76s": 0, "75s": 0, "74s": 0, "73s": 0, "72s": 0,
  "65s": 0, "64s": 0, "63s": 0, "62s": 0,
  "54s": 0, "53s": 0, "52s": 0,
  "43s": 0, "42s": 0,
  "32s": 0,
  AKo: 100, AQo: 90, AJo: 50, ATo: 15, A9o: 0, A8o: 0, A7o: 0, A6o: 0, A5o: 15, A4o: 0, A3o: 0, A2o: 0,
  KQo: 50, KJo: 15, KTo: 0, K9o: 0, K8o: 0, K7o: 0, K6o: 0, K5o: 0, K4o: 0, K3o: 0, K2o: 0,
  QJo: 10, QTo: 0, Q9o: 0, Q8o: 0, Q7o: 0, Q6o: 0, Q5o: 0, Q4o: 0, Q3o: 0, Q2o: 0,
  JTo: 0, J9o: 0, J8o: 0, J7o: 0, J6o: 0, J5o: 0, J4o: 0, J3o: 0, J2o: 0,
  T9o: 0, T8o: 0, T7o: 0, T6o: 0, T5o: 0, T4o: 0, T3o: 0, T2o: 0,
  "98o": 0, "97o": 0, "96o": 0, "95o": 0, "94o": 0, "93o": 0, "92o": 0,
  "87o": 0, "86o": 0, "85o": 0, "84o": 0, "83o": 0, "82o": 0,
  "76o": 0, "75o": 0, "74o": 0, "73o": 0, "72o": 0,
  "65o": 0, "64o": 0, "63o": 0, "62o": 0,
  "54o": 0, "53o": 0, "52o": 0,
  "43o": 0, "42o": 0,
  "32o": 0,
};

// BB 3-bet vs BTN open
const BB_3BET_VS_BTN: Record<string, number> = {
  AA: 100, KK: 100, QQ: 100, JJ: 90, TT: 50, "99": 20, "88": 10, "77": 0, "66": 0, "55": 0, "44": 0, "33": 0, "22": 0,
  AKs: 100, AQs: 100, AJs: 80, ATs: 50, A9s: 25, A8s: 10, A7s: 10, A6s: 0, A5s: 50, A4s: 35, A3s: 20, A2s: 10,
  KQs: 80, KJs: 45, KTs: 20, K9s: 0, K8s: 0, K7s: 0, K6s: 0, K5s: 0, K4s: 0, K3s: 0, K2s: 0,
  QJs: 35, QTs: 15, Q9s: 0, Q8s: 0, Q7s: 0, Q6s: 0, Q5s: 0, Q4s: 0, Q3s: 0, Q2s: 0,
  JTs: 20, J9s: 0, J8s: 0, J7s: 0, J6s: 0, J5s: 0, J4s: 0, J3s: 0, J2s: 0,
  T9s: 10, T8s: 0, T7s: 0, T6s: 0, T5s: 0, T4s: 0, T3s: 0, T2s: 0,
  "98s": 0, "97s": 0, "96s": 0, "95s": 0, "94s": 0, "93s": 0, "92s": 0,
  "87s": 0, "86s": 0, "85s": 0, "84s": 0, "83s": 0, "82s": 0,
  "76s": 0, "75s": 0, "74s": 0, "73s": 0, "72s": 0,
  "65s": 0, "64s": 0, "63s": 0, "62s": 0,
  "54s": 0, "53s": 0, "52s": 0,
  "43s": 0, "42s": 0,
  "32s": 0,
  AKo: 100, AQo: 70, AJo: 30, ATo: 10, A9o: 0, A8o: 0, A7o: 0, A6o: 0, A5o: 10, A4o: 0, A3o: 0, A2o: 0,
  KQo: 30, KJo: 10, KTo: 0, K9o: 0, K8o: 0, K7o: 0, K6o: 0, K5o: 0, K4o: 0, K3o: 0, K2o: 0,
  QJo: 0, QTo: 0, Q9o: 0, Q8o: 0, Q7o: 0, Q6o: 0, Q5o: 0, Q4o: 0, Q3o: 0, Q2o: 0,
  JTo: 0, J9o: 0, J8o: 0, J7o: 0, J6o: 0, J5o: 0, J4o: 0, J3o: 0, J2o: 0,
  T9o: 0, T8o: 0, T7o: 0, T6o: 0, T5o: 0, T4o: 0, T3o: 0, T2o: 0,
  "98o": 0, "97o": 0, "96o": 0, "95o": 0, "94o": 0, "93o": 0, "92o": 0,
  "87o": 0, "86o": 0, "85o": 0, "84o": 0, "83o": 0, "82o": 0,
  "76o": 0, "75o": 0, "74o": 0, "73o": 0, "72o": 0,
  "65o": 0, "64o": 0, "63o": 0, "62o": 0,
  "54o": 0, "53o": 0, "52o": 0,
  "43o": 0, "42o": 0,
  "32o": 0,
};

export const THREEBET_RANGES: RangeData[] = [
  { position: "BTN", action: "3-Bet", scenario: "vs CO Open, 6-Max, 100bb", grid: BTN_3BET_VS_CO },
  { position: "CO", action: "3-Bet", scenario: "vs HJ Open, 6-Max, 100bb", grid: CO_3BET_VS_HJ },
  { position: "SB", action: "3-Bet", scenario: "vs BTN Open, 6-Max, 100bb", grid: SB_3BET_VS_BTN },
  { position: "BB", action: "3-Bet", scenario: "vs SB Open, 6-Max, 100bb", grid: BB_3BET_VS_SB },
  { position: "BB", action: "3-Bet", scenario: "vs BTN Open, 6-Max, 100bb", grid: BB_3BET_VS_BTN },
];

export const ALL_RANGES = [...PREFLOP_RANGES, ...THREEBET_RANGES];

// Stack depth multiplier: tighter with shorter stacks
// Returns a multiplier (0-1) to apply to frequencies
export function getStackDepthMultiplier(stackBB: number): number {
  if (stackBB >= 100) return 1.0;
  if (stackBB >= 60) return 0.9;
  if (stackBB >= 40) return 0.75;
  if (stackBB >= 30) return 0.6;
  if (stackBB >= 20) return 0.45;
  return 0.35;
}

// Adjust a range grid for stack depth
export function adjustRangeForStack(grid: Record<string, number>, stackBB: number): Record<string, number> {
  if (stackBB >= 100) return grid;
  const mult = getStackDepthMultiplier(stackBB);
  const adjusted: Record<string, number> = {};
  for (const [hand, freq] of Object.entries(grid)) {
    // Premium hands stay at full frequency, marginal hands get reduced
    if (freq >= 90) {
      adjusted[hand] = freq;
    } else if (freq >= 70) {
      adjusted[hand] = Math.round(freq * (1 - (1 - mult) * 0.3));
    } else {
      adjusted[hand] = Math.round(freq * mult);
    }
  }
  return adjusted;
}
