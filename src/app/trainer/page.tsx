"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import PokerTable, { Card, PlayerSeat } from "@/components/PokerTable";
import {
  PREFLOP_RANGES,
  THREEBET_RANGES,
  RANKS,
  getHandKey,
  getFrequencyColor,
  isPair,
  adjustRangeForStack,
  RangeData,
} from "@/data/preflop-ranges";

// ── Constants ──────────────────────────────────────────────────────
const POSITIONS = ["UTG", "HJ", "CO", "BTN", "SB", "BB"] as const;
type Position = (typeof POSITIONS)[number];

const CARD_RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
const SUITS: Card["suit"][] = ["s", "h", "d", "c"];

const STACK_DEPTHS = [20, 30, 40, 60, 100, 200] as const;
type StackDepth = (typeof STACK_DEPTHS)[number];

type SpotType = "RFI" | "3-Bet" | "vs3Bet";
type Street = "preflop" | "flop" | "turn" | "river";
type StartingStreet = "preflop" | "flop" | "turn" | "river";
type SpeedMode = "normal" | "fast";

// ── Hand rank constants ──────────────────────────────────────────
const RANK_VALUES: Record<string, number> = {
  A: 14, K: 13, Q: 12, J: 11, T: 10, "9": 9, "8": 8, "7": 7, "6": 6, "5": 5, "4": 4, "3": 3, "2": 2,
};

// ── Settings ──────────────────────────────────────────────────────
interface TrainerSettings {
  positions: Record<Position, boolean>;
  stackDepth: StackDepth;
  blinds: string;
  spotTypes: Record<SpotType, boolean>;
  startingStreet: StartingStreet;
  speed: SpeedMode;
}

const DEFAULT_SETTINGS: TrainerSettings = {
  positions: { UTG: true, HJ: true, CO: true, BTN: true, SB: true, BB: true },
  stackDepth: 100,
  blinds: "0.5/1",
  spotTypes: { RFI: true, "3-Bet": true, vs3Bet: false },
  startingStreet: "preflop",
  speed: "normal",
};

// ── Session Stats ─────────────────────────────────────────────────
interface PositionStats {
  correct: number;
  total: number;
}

interface SessionStats {
  correct: number;
  total: number;
  streak: number;
  bestStreak: number;
  perPosition: Record<Position, PositionStats>;
  mistakes: { handKey: string; position: string; scenario: string; yourAction: string; gtoAction: string }[];
  handsWon: number;
  handsLost: number;
  totalBBWon: number;
}

function emptySessionStats(): SessionStats {
  const perPos = {} as Record<Position, PositionStats>;
  for (const p of POSITIONS) perPos[p] = { correct: 0, total: 0 };
  return { correct: 0, total: 0, streak: 0, bestStreak: 0, perPosition: perPos, mistakes: [], handsWon: 0, handsLost: 0, totalBBWon: 0 };
}

// ── Deck helpers ───────────────────────────────────────────────────
function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const r of CARD_RANKS) for (const s of SUITS) deck.push({ rank: r, suit: s });
  return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ── Hand-key conversion (e.g. Ah Kh -> "AKs") ─────────────────────
function cardsToHandKey(c1: Card, c2: Card): string {
  const ri1 = CARD_RANKS.indexOf(c1.rank as (typeof CARD_RANKS)[number]);
  const ri2 = CARD_RANKS.indexOf(c2.rank as (typeof CARD_RANKS)[number]);
  const higher = ri1 <= ri2 ? c1 : c2;
  const lower = ri1 <= ri2 ? c2 : c1;
  if (higher.rank === lower.rank) return `${higher.rank}${lower.rank}`;
  const suited = higher.suit === lower.suit ? "s" : "o";
  return `${higher.rank}${lower.rank}${suited}`;
}

// ── Hand Evaluation ──────────────────────────────────────────────
type HandRank = "High Card" | "Pair" | "Two Pair" | "Three of a Kind" | "Straight" | "Flush" | "Full House" | "Four of a Kind" | "Straight Flush";

interface HandEvaluation {
  rank: HandRank;
  description: string;
  strength: number; // 0-9 scale
}

function evaluateHand(holeCards: Card[], boardCards: Card[]): HandEvaluation {
  const allCards = [...holeCards, ...boardCards];
  if (allCards.length < 2) return { rank: "High Card", description: "High card", strength: 0 };

  const values = allCards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = allCards.map((c) => c.suit);
  const holeValues = holeCards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a);

  // Count occurrences
  const valueCounts: Record<number, number> = {};
  for (const v of values) valueCounts[v] = (valueCounts[v] || 0) + 1;

  // Check flush
  const suitCounts: Record<string, number> = {};
  for (const s of suits) suitCounts[s] = (suitCounts[s] || 0) + 1;
  const flushSuit = Object.entries(suitCounts).find(([, c]) => c >= 5)?.[0];
  const isFlush = !!flushSuit;

  // Check straight
  const uniqueVals = [...new Set(values)].sort((a, b) => b - a);
  let isStraight = false;
  let straightHigh = 0;
  for (let i = 0; i <= uniqueVals.length - 5; i++) {
    if (uniqueVals[i] - uniqueVals[i + 4] === 4) {
      isStraight = true;
      straightHigh = uniqueVals[i];
      break;
    }
  }
  // Check A-2-3-4-5 straight (wheel)
  if (!isStraight && uniqueVals.includes(14) && uniqueVals.includes(2) && uniqueVals.includes(3) && uniqueVals.includes(4) && uniqueVals.includes(5)) {
    isStraight = true;
    straightHigh = 5;
  }

  // Check straight flush
  if (isFlush && isStraight) {
    const flushCards = allCards.filter((c) => c.suit === flushSuit);
    const flushVals = [...new Set(flushCards.map((c) => RANK_VALUES[c.rank]))].sort((a, b) => b - a);
    let isStraightFlush = false;
    for (let i = 0; i <= flushVals.length - 5; i++) {
      if (flushVals[i] - flushVals[i + 4] === 4) {
        isStraightFlush = true;
        break;
      }
    }
    if (!isStraightFlush && flushVals.includes(14) && flushVals.includes(2) && flushVals.includes(3) && flushVals.includes(4) && flushVals.includes(5)) {
      isStraightFlush = true;
    }
    if (isStraightFlush) {
      return { rank: "Straight Flush", description: `Straight flush`, strength: 9 };
    }
  }

  const counts = Object.values(valueCounts).sort((a, b) => b - a);

  // Four of a kind
  if (counts[0] === 4) {
    const quadVal = Number(Object.entries(valueCounts).find(([, c]) => c === 4)![0]);
    const rankName = Object.entries(RANK_VALUES).find(([, v]) => v === quadVal)?.[0] || "";
    return { rank: "Four of a Kind", description: `Quad ${rankName}s`, strength: 8 };
  }

  // Full house
  if (counts[0] === 3 && counts[1] >= 2) {
    const tripVal = Number(Object.entries(valueCounts).find(([, c]) => c === 3)![0]);
    const rankName = Object.entries(RANK_VALUES).find(([, v]) => v === tripVal)?.[0] || "";
    return { rank: "Full House", description: `Full house, ${rankName}s full`, strength: 7 };
  }

  // Flush
  if (isFlush) {
    const heroFlushCards = holeCards.filter((c) => c.suit === flushSuit);
    if (heroFlushCards.length > 0) {
      const highFlush = Math.max(...heroFlushCards.map((c) => RANK_VALUES[c.rank]));
      if (highFlush === 14) return { rank: "Flush", description: "Nut flush", strength: 6.5 };
      const rankName = Object.entries(RANK_VALUES).find(([, v]) => v === highFlush)?.[0] || "";
      return { rank: "Flush", description: `${rankName}-high flush`, strength: 6 };
    }
    return { rank: "Flush", description: "Board flush", strength: 5.5 };
  }

  // Straight
  if (isStraight) {
    const rankName = Object.entries(RANK_VALUES).find(([, v]) => v === straightHigh)?.[0] || "";
    return { rank: "Straight", description: `${rankName}-high straight`, strength: 5 };
  }

  // Three of a kind
  if (counts[0] === 3) {
    const tripVal = Number(Object.entries(valueCounts).find(([, c]) => c === 3)![0]);
    const heroHasTrip = holeValues.includes(tripVal);
    const rankName = Object.entries(RANK_VALUES).find(([, v]) => v === tripVal)?.[0] || "";
    return {
      rank: "Three of a Kind",
      description: heroHasTrip ? `Trip ${rankName}s (set)` : `Trip ${rankName}s`,
      strength: 4,
    };
  }

  // Two pair
  if (counts[0] === 2 && counts[1] === 2) {
    const pairVals = Object.entries(valueCounts)
      .filter(([, c]) => c === 2)
      .map(([v]) => Number(v))
      .sort((a, b) => b - a);
    const high = Object.entries(RANK_VALUES).find(([, v]) => v === pairVals[0])?.[0] || "";
    const low = Object.entries(RANK_VALUES).find(([, v]) => v === pairVals[1])?.[0] || "";
    return { rank: "Two Pair", description: `Two pair, ${high}s and ${low}s`, strength: 3 };
  }

  // One pair
  if (counts[0] === 2) {
    const pairVal = Number(Object.entries(valueCounts).find(([, c]) => c === 2)![0]);
    const rankName = Object.entries(RANK_VALUES).find(([, v]) => v === pairVal)?.[0] || "";
    const boardValues = boardCards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a);
    const heroHasPair = holeValues.includes(pairVal);

    if (heroHasPair && boardValues.length > 0) {
      if (pairVal > boardValues[0]) {
        return { rank: "Pair", description: `Overpair (${rankName}${rankName})`, strength: 2.8 };
      } else if (pairVal === boardValues[0]) {
        const kicker = holeValues.find((v) => v !== pairVal) || 0;
        const kickerName = Object.entries(RANK_VALUES).find(([, v]) => v === kicker)?.[0] || "";
        return { rank: "Pair", description: `Top pair, ${kickerName} kicker`, strength: 2.5 };
      } else if (boardValues.length >= 2 && pairVal === boardValues[1]) {
        return { rank: "Pair", description: `Middle pair (${rankName}s)`, strength: 2 };
      } else {
        return { rank: "Pair", description: `Bottom pair (${rankName}s)`, strength: 1.5 };
      }
    }
    // Pocket pair below board or board pair
    if (holeValues[0] === holeValues[1] && holeValues[0] === pairVal) {
      return { rank: "Pair", description: `Pocket ${rankName}s`, strength: 2 };
    }
    return { rank: "Pair", description: `Pair of ${rankName}s`, strength: 1.5 };
  }

  // High card
  const highRank = Object.entries(RANK_VALUES).find(([, v]) => v === holeValues[0])?.[0] || "";
  return { rank: "High Card", description: `${highRank} high`, strength: 0.5 };
}

// ── Board Texture Analysis ──────────────────────────────────────
interface BoardTexture {
  type: "Dry" | "Semi-wet" | "Wet";
  flushDraw: boolean;
  flushComplete: boolean;
  straightDraw: boolean;
  straightComplete: boolean;
  paired: boolean;
  advice: string;
  cbetFrequency: string;
}

function analyzeBoardTexture(boardCards: Card[]): BoardTexture {
  if (boardCards.length === 0) {
    return { type: "Dry", flushDraw: false, flushComplete: false, straightDraw: false, straightComplete: false, paired: false, advice: "", cbetFrequency: "" };
  }

  const suits = boardCards.map((c) => c.suit);
  const values = boardCards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a);

  // Suit analysis
  const suitCounts: Record<string, number> = {};
  for (const s of suits) suitCounts[s] = (suitCounts[s] || 0) + 1;
  const maxSuitCount = Math.max(...Object.values(suitCounts));
  const flushDraw = maxSuitCount >= 2 && maxSuitCount < 5;
  const flushComplete = maxSuitCount >= 5;
  const monotone = maxSuitCount >= 3 && boardCards.length <= 3;
  const twoTone = maxSuitCount === 2 && boardCards.length >= 3;

  // Connectivity / straight analysis
  const uniqueVals = [...new Set(values)].sort((a, b) => a - b);
  let maxConnected = 1;
  let currentRun = 1;
  for (let i = 1; i < uniqueVals.length; i++) {
    if (uniqueVals[i] - uniqueVals[i - 1] <= 2) {
      currentRun++;
      maxConnected = Math.max(maxConnected, currentRun);
    } else {
      currentRun = 1;
    }
  }
  const straightDraw = maxConnected >= 3;

  // Check for complete straights
  let straightComplete = false;
  if (uniqueVals.length >= 5) {
    for (let i = 0; i <= uniqueVals.length - 5; i++) {
      if (uniqueVals[i + 4] - uniqueVals[i] === 4) { straightComplete = true; break; }
    }
  }

  // Paired board
  const valueCounts: Record<number, number> = {};
  for (const v of values) valueCounts[v] = (valueCounts[v] || 0) + 1;
  const paired = Object.values(valueCounts).some((c) => c >= 2);

  // Calculate wetness score
  let wetness = 0;
  if (monotone) wetness += 3;
  else if (twoTone) wetness += 1;
  if (maxConnected >= 4) wetness += 3;
  else if (maxConnected >= 3) wetness += 2;
  else if (maxConnected >= 2) wetness += 1;
  if (values.filter((v) => v >= 8 && v <= 12).length >= 2) wetness += 1; // broadway heavy

  let type: "Dry" | "Semi-wet" | "Wet";
  let advice: string;
  let cbetFrequency: string;

  if (wetness <= 1) {
    type = "Dry";
    advice = "Dry board favors preflop aggressor. C-bet wide at small sizing.";
    cbetFrequency = "C-bet ~75% of range at 33% pot";
  } else if (wetness <= 3) {
    type = "Semi-wet";
    advice = "Semi-wet board. Be selective with c-bets, use medium sizing.";
    cbetFrequency = "C-bet ~55% of range at 50-66% pot";
  } else {
    type = "Wet";
    advice = "Wet/connected board. Check more, bet bigger when you do bet.";
    cbetFrequency = "C-bet ~35% of range at 66-75% pot";
  }

  if (paired) {
    advice += " Paired board reduces opponent's hit frequency.";
  }

  return { type, flushDraw, flushComplete, straightDraw, straightComplete, paired, advice, cbetFrequency };
}

// ── Draw Analysis ────────────────────────────────────────────────
function analyzeDraws(holeCards: Card[], boardCards: Card[]): string[] {
  const draws: string[] = [];
  if (boardCards.length < 3) return draws;

  const allCards = [...holeCards, ...boardCards];
  const suitCounts: Record<string, number> = {};
  for (const c of allCards) suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;

  // Flush draw check
  for (const [suit, count] of Object.entries(suitCounts)) {
    if (count === 4 && holeCards.some((c) => c.suit === suit)) {
      const heroFlushCards = holeCards.filter((c) => c.suit === suit);
      const highCard = Math.max(...heroFlushCards.map((c) => RANK_VALUES[c.rank]));
      if (highCard === 14) draws.push("Nut flush draw");
      else draws.push("Flush draw");
    }
  }

  // Straight draw check (simplified)
  const allValues = [...new Set(allCards.map((c) => RANK_VALUES[c.rank]))].sort((a, b) => a - b);
  const heroValues = holeCards.map((c) => RANK_VALUES[c.rank]);

  // Check for open-ended straight draws (4 in a row that include at least one hole card)
  for (let start = 2; start <= 11; start++) {
    const needed = [start, start + 1, start + 2, start + 3];
    const have = needed.filter((v) => allValues.includes(v));
    if (have.length === 4 && needed.some((v) => heroValues.includes(v))) {
      draws.push("Open-ended straight draw");
      break;
    }
  }

  // Gutshot check
  if (!draws.some((d) => d.includes("straight"))) {
    for (let start = 1; start <= 10; start++) {
      const needed = [start, start + 1, start + 2, start + 3, start + 4];
      const have = needed.filter((v) => allValues.includes(v));
      if (have.length === 4 && needed.some((v) => heroValues.includes(v))) {
        draws.push("Gutshot straight draw");
        break;
      }
    }
  }

  // Overcards
  if (boardCards.length >= 3) {
    const boardMax = Math.max(...boardCards.map((c) => RANK_VALUES[c.rank]));
    const overCards = holeCards.filter((c) => RANK_VALUES[c.rank] > boardMax);
    if (overCards.length === 2) draws.push("Two overcards");
    else if (overCards.length === 1) draws.push("One overcard");
  }

  return draws;
}

// ── Action Feedback ─────────────────────────────────────────────
type FeedbackRating = "perfect" | "good" | "bad";

interface ActionFeedback {
  rating: FeedbackRating;
  yourAction: string;
  gtoAction: string;
  explanation: string;
  street: Street;
  timestamp: number;
}

function getGTORecommendation(
  street: Street,
  hand: {
    gtoAction: string;
    gtoFrequency: number;
    heroIsIP: boolean;
    facingBet: boolean;
    facingBetAmount: number;
    potSize: number;
    heroCards: [Card, Card];
    visibleBoard: Card[];
  },
): { action: string; explanation: string } {
  if (street === "preflop") {
    if (hand.gtoFrequency >= 50) {
      return { action: hand.gtoAction, explanation: `GTO preflop: ${hand.gtoAction} at ${hand.gtoFrequency}% frequency.` };
    } else {
      return { action: "Fold", explanation: `GTO preflop: Fold (raise frequency only ${hand.gtoFrequency}%).` };
    }
  }

  // Postflop
  const handEval = evaluateHand(hand.heroCards, hand.visibleBoard);
  const draws = analyzeDraws(hand.heroCards, hand.visibleBoard);
  const hasFlushDraw = draws.some((d) => d.toLowerCase().includes("flush draw"));
  const hasOESD = draws.some((d) => d.toLowerCase().includes("open-ended"));
  const hasDraws = hasFlushDraw || hasOESD;

  if (hand.facingBet) {
    // Facing a bet
    if (handEval.strength >= 5) {
      return { action: "Raise", explanation: `Monster hand (${handEval.description}). Raise for value.` };
    }
    if (handEval.strength >= 3) {
      return { action: "Call", explanation: `Strong hand (${handEval.description}). Call to continue.` };
    }
    if (handEval.strength >= 2 && hasDraws) {
      return { action: "Call", explanation: `${handEval.description} with draws (${draws.join(", ")}). Call with equity.` };
    }
    if (hasFlushDraw || hasOESD) {
      return { action: "Call", explanation: `Drawing hand (${draws.join(", ")}). Call if getting odds.` };
    }
    if (handEval.strength < 1.5 && !hasDraws) {
      return { action: "Fold", explanation: `Weak hand (${handEval.description}), no draws. Fold vs bet.` };
    }
    // Medium hands default call
    return { action: "Call", explanation: `Medium hand (${handEval.description}). Calling is reasonable.` };
  }

  // Not facing a bet
  if (handEval.strength >= 4) {
    return { action: "Bet 66-75% pot", explanation: `Strong hand (${handEval.description}). Value bet for protection and value.` };
  }
  if (handEval.strength >= 2.5 && hand.heroIsIP) {
    return { action: "Bet 33-50% pot", explanation: `Decent hand (${handEval.description}) in position. Thin value bet.` };
  }
  if (handEval.strength >= 2.5 && !hand.heroIsIP) {
    return { action: "Check", explanation: `Decent hand (${handEval.description}) OOP. Prefer checking to control pot.` };
  }
  if ((hasFlushDraw || hasOESD) && handEval.strength < 2.5) {
    return { action: "Bet 50% pot", explanation: `Drawing hand (${draws.join(", ")}). Semi-bluff opportunity.` };
  }
  if (handEval.strength < 1 && !hasDraws) {
    return { action: "Check", explanation: `Weak hand (${handEval.description}), no draws. Give up.` };
  }
  if (handEval.strength < 1 && hasDraws) {
    return { action: "Check", explanation: `Weak hand with draws (${draws.join(", ")}). Check with equity.` };
  }
  return { action: "Check", explanation: `Marginal hand (${handEval.description}). Check is standard.` };
}

function rateAction(
  heroAction: string,
  gtoRec: string,
  street: Street,
  handStrength: number,
  hasDraws: boolean,
  facingBet: boolean,
  gtoFrequency?: number,
): FeedbackRating {
  const ha = heroAction.toLowerCase();
  const gr = gtoRec.toLowerCase();

  // Categorize actions
  const heroCategory = ha === "fold" ? "fold"
    : ha === "check" ? "check"
    : ha === "call" ? "call"
    : (ha.startsWith("bet") || ha.startsWith("raise") || ha === "all-in") ? "aggressive" : "unknown";

  const gtoCategory = gr === "fold" ? "fold"
    : gr === "check" ? "check"
    : gr === "call" ? "call"
    : (gr.startsWith("bet") || gr.startsWith("raise")) ? "aggressive" : "unknown";

  // ── PERFECT: Exact match ──
  if (heroCategory === gtoCategory) return "perfect";

  // Preflop: use frequency for mixed spots
  if (street === "preflop" && gtoFrequency !== undefined) {
    // Mixed spot (frequency 20-80%) — aggressive or fold are both acceptable
    if (gtoFrequency >= 20 && gtoFrequency <= 80) {
      if (heroCategory === "aggressive" || heroCategory === "fold") return "good";
    }
    // Strong raise spot but hero folded = bad
    if (gtoFrequency >= 80 && heroCategory === "fold") return "bad";
    // Clear fold but hero raised = bad
    if (gtoFrequency < 15 && heroCategory === "aggressive") return "bad";
  }

  // ── GOOD: Acceptable alternative ──

  // Calling when GTO says raise (not terrible, just passive)
  if (heroCategory === "call" && gtoCategory === "aggressive") {
    if (handStrength >= 2) return "good"; // decent hand, calling is ok
    return "bad"; // bluffing spot, calling makes no sense
  }

  // Betting/raising when GTO says call (being aggressive with a calling hand)
  if (heroCategory === "aggressive" && gtoCategory === "call") {
    if (handStrength >= 3) return "good"; // strong hand, raising for value is fine
    if (hasDraws) return "good"; // semi-bluff is acceptable
    return "bad"; // turning a bluff-catcher into a bluff
  }

  // Checking when GTO says bet small (missed a thin value bet, not terrible)
  if (heroCategory === "check" && gtoCategory === "aggressive") {
    if (handStrength >= 4) return "bad"; // missing big value = bad
    if (handStrength >= 2) return "good"; // missing thin value = ok
    return "good"; // was a bluff anyway, checking is fine
  }

  // Betting when GTO says check
  if (heroCategory === "aggressive" && gtoCategory === "check") {
    if (handStrength >= 3) return "good"; // betting a decent hand for value
    if (hasDraws) return "good"; // semi-bluff
    if (handStrength < 1) return "good"; // turning air into a bluff (could go either way)
    return "bad"; // betting a medium hand turns it into a bluff
  }

  // Calling when GTO says fold (burning money)
  if (heroCategory === "call" && gtoCategory === "fold") {
    if (hasDraws) return "good"; // calling with draws has some merit
    return "bad";
  }

  // Folding when GTO says call (too tight)
  if (heroCategory === "fold" && gtoCategory === "call") {
    if (handStrength < 1.5 && !hasDraws) return "good"; // borderline fold
    return "bad";
  }

  // Folding when GTO says bet/raise (folding a strong hand)
  if (heroCategory === "fold" && gtoCategory === "aggressive") {
    if (!facingBet) return "bad"; // folding when nobody bet?!
    if (handStrength >= 2) return "bad"; // folding a playable hand
    return "bad";
  }

  // Raising when GTO says fold
  if (heroCategory === "aggressive" && gtoCategory === "fold") return "bad";

  return "bad";
}

// ── Scenario Types ──────────────────────────────────────────────
interface ActionEntry {
  position: string;
  stack: number;
  action: string;
  street?: Street;
}

interface HandState {
  deck: Card[];
  deckIndex: number;
  heroPosition: Position;
  heroCards: [Card, Card];
  villainPosition: Position;
  villainCards: [Card, Card];
  boardCards: Card[]; // all 5 dealt (revealed progressively)
  visibleBoard: Card[]; // currently visible community cards
  players: PlayerSeat[];
  stacks: Record<string, number>;
  potSize: number;
  street: Street;
  actionHistory: ActionEntry[];
  streetActions: Record<Street, ActionEntry[]>;
  handKey: string;
  spotType: SpotType;
  rangeScenario: string;
  rangeGrid: Record<string, number>;
  raiserPosition?: string;
  gtoAction: "Fold" | "Call" | "Raise" | "Allin";
  gtoFrequency: number;
  callFrequency: number;
  foldFrequency: number;
  explanation: string;
  heroIsIP: boolean; // hero is in position
  villainFolded: boolean;
  heroFolded: boolean;
  handComplete: boolean;
  heroWon: boolean | null; // null = still playing
  bbWon: number;
  showdownReached: boolean;
  waitingForHero: boolean;
  villainActedThisStreet: boolean;
  heroActedThisStreet: boolean;
  facingBet: boolean;
  facingBetAmount: number;
  heroBetThisStreet: number;
  villainBetThisStreet: number;
  startingStack: number;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getEnabledPositions(settings: TrainerSettings): Position[] {
  return POSITIONS.filter((p) => settings.positions[p]);
}

function generateExplanation(handKey: string, position: string, gtoAction: string, freq: number, spotType: SpotType): string {
  const actionWord = gtoAction === "Raise" ? (spotType === "3-Bet" ? "3-bet" : "open-raise") : "fold";
  if (freq >= 95) return `${handKey} is a mandatory ${actionWord} from ${position} (${gtoAction.toLowerCase()} 100%)`;
  if (freq >= 70) return `${handKey} is a strong ${actionWord} from ${position} (${freq}% frequency)`;
  if (freq >= 40) return `${handKey} is a mixed spot from ${position} -- ${actionWord} ${freq}% of the time`;
  if (freq > 0) return `${handKey} is mostly a fold from ${position} but can be ${spotType === "3-Bet" ? "3-bet" : "raised"} at low frequency (${freq}%)`;
  return `${handKey} should always be folded from ${position}`;
}

// ── Generate Full Hand ──────────────────────────────────────────
function generateHand(settings: TrainerSettings): HandState {
  const deck = shuffleDeck(buildDeck());
  let idx = 0;
  const deal = (): Card => deck[idx++];

  const enabledPositions = getEnabledPositions(settings);
  if (enabledPositions.length === 0) enabledPositions.push("BTN");

  const stack = settings.stackDepth;

  // Decide spot type
  const enabledSpots: SpotType[] = [];
  if (settings.spotTypes.RFI) enabledSpots.push("RFI");
  if (settings.spotTypes["3-Bet"]) enabledSpots.push("3-Bet");
  if (enabledSpots.length === 0) enabledSpots.push("RFI");

  const spotType = pickRandom(enabledSpots);

  let heroPos: Position;
  let villainPos: Position;
  let rangeData: RangeData | undefined;
  const actionHistory: ActionEntry[] = [];
  const stacks: Record<string, number> = {};
  POSITIONS.forEach((p) => (stacks[p] = stack));
  stacks["SB"] -= 0.5;
  stacks["BB"] -= 1;
  let pot = 1.5;
  let raiserPosition: string | undefined;

  if (spotType === "3-Bet") {
    const available3Bets = THREEBET_RANGES.filter((r) => enabledPositions.includes(r.position as Position));
    if (available3Bets.length > 0) {
      rangeData = pickRandom(available3Bets);
      heroPos = rangeData.position as Position;
      if (rangeData.scenario.includes("vs CO")) raiserPosition = "CO";
      else if (rangeData.scenario.includes("vs HJ")) raiserPosition = "HJ";
      else if (rangeData.scenario.includes("vs BTN")) raiserPosition = "BTN";
      else if (rangeData.scenario.includes("vs SB")) raiserPosition = "SB";

      villainPos = (raiserPosition || "CO") as Position;

      const raiserIdx = raiserPosition ? POSITIONS.indexOf(raiserPosition as Position) : 0;
      const heroIdx = POSITIONS.indexOf(heroPos);

      for (let i = 0; i < raiserIdx; i++) {
        const pos = POSITIONS[i];
        actionHistory.push({ position: pos, stack: stacks[pos], action: "Fold", street: "preflop" });
      }

      if (raiserPosition) {
        stacks[raiserPosition] -= 2.5;
        pot += 2.5;
        actionHistory.push({ position: raiserPosition, stack: stacks[raiserPosition], action: "Raise 2.5", street: "preflop" });
      }

      for (let i = raiserIdx + 1; i < heroIdx; i++) {
        const pos = POSITIONS[i];
        if (pos !== heroPos) {
          actionHistory.push({ position: pos, stack: stacks[pos], action: "Fold", street: "preflop" });
        }
      }
    } else {
      heroPos = pickRandom(enabledPositions);
      rangeData = PREFLOP_RANGES.find((r) => r.position === heroPos);
      villainPos = "BB";
      const heroIdx = POSITIONS.indexOf(heroPos);
      for (let i = 0; i < heroIdx; i++) {
        const pos = POSITIONS[i];
        actionHistory.push({ position: pos, stack: stacks[pos], action: "Fold", street: "preflop" });
      }
    }
  } else {
    const rfiPositions = enabledPositions.filter((p) => PREFLOP_RANGES.some((r) => r.position === p));
    heroPos = rfiPositions.length > 0 ? pickRandom(rfiPositions) : pickRandom(enabledPositions);
    rangeData = PREFLOP_RANGES.find((r) => r.position === heroPos);

    // Pick a villain from remaining active positions (usually BB or a caller)
    const heroIdx = POSITIONS.indexOf(heroPos);
    for (let i = 0; i < heroIdx; i++) {
      const pos = POSITIONS[i];
      actionHistory.push({ position: pos, stack: stacks[pos], action: "Fold", street: "preflop" });
    }

    // Villain will be BB by default (or last active)
    villainPos = "BB";
  }

  // Deal cards
  const heroCards: [Card, Card] = [deal(), deal()];
  const villainCards: [Card, Card] = [deal(), deal()];
  const boardCards: Card[] = [deal(), deal(), deal(), deal(), deal()]; // all 5

  const handKey = cardsToHandKey(heroCards[0], heroCards[1]);

  // Determine GTO action
  let grid: Record<string, number> = {};
  let gtoFrequency = 0;
  let gtoAction: "Fold" | "Call" | "Raise" | "Allin" = "Fold";
  let rangeScenario = "";

  if (rangeData) {
    grid = adjustRangeForStack(rangeData.grid, stack);
    gtoFrequency = grid[handKey] ?? 0;
    gtoAction = gtoFrequency >= 50 ? "Raise" : "Fold";
    rangeScenario = `${rangeData.scenario}${stack !== 100 ? ` (${stack}bb)` : ""}`;
  } else {
    rangeScenario = `6-Max, ${stack}bb, ${heroPos}`;
  }

  const callFrequency = spotType === "3-Bet" ? Math.max(0, Math.min(100, 100 - gtoFrequency - (100 - gtoFrequency) * 0.6)) : 0;
  const foldFrequency = 100 - gtoFrequency - callFrequency;
  const explanation = generateExplanation(handKey, heroPos, gtoAction, gtoFrequency, spotType);

  // Determine IP/OOP
  const heroIdx = POSITIONS.indexOf(heroPos);
  const villainIdx = POSITIONS.indexOf(villainPos);
  // In poker, BTN acts last postflop. Higher index = later position = IP postflop
  // SB(4) and BB(5) are special: SB acts before BB, BB acts after SB
  // Postflop order: SB first, then BB, then UTG...BTN
  const postflopOrder = (pos: Position): number => {
    const i = POSITIONS.indexOf(pos);
    if (i === 4) return 0; // SB first
    if (i === 5) return 1; // BB second
    return i + 2; // UTG=2, HJ=3, CO=4, BTN=5
  };
  const heroIsIP = postflopOrder(heroPos) > postflopOrder(villainPos);

  // Build player seats
  const players: PlayerSeat[] = POSITIONS.map((pos) => {
    let folded = false;
    let lastAction: string | undefined = undefined;
    const entry = actionHistory.find((a) => a.position === pos);
    if (entry) {
      folded = entry.action === "Fold";
      lastAction = entry.action;
    }

    return {
      position: pos,
      stack: stacks[pos],
      isHero: pos === heroPos,
      isActive: !folded,
      isCurrent: pos === heroPos,
      lastAction,
      hasFolded: folded,
      currentBet: 0,
    };
  });

  idx = idx; // capture deck index

  return {
    deck,
    deckIndex: idx,
    heroPosition: heroPos,
    heroCards,
    villainPosition: villainPos,
    villainCards,
    boardCards,
    visibleBoard: [],
    players,
    stacks: { ...stacks },
    potSize: pot,
    street: "preflop",
    actionHistory,
    streetActions: { preflop: [...actionHistory], flop: [], turn: [], river: [] },
    handKey,
    spotType,
    rangeScenario,
    rangeGrid: grid,
    raiserPosition,
    gtoAction,
    gtoFrequency,
    callFrequency,
    foldFrequency,
    explanation,
    heroIsIP,
    villainFolded: false,
    heroFolded: false,
    handComplete: false,
    heroWon: null,
    bbWon: 0,
    showdownReached: false,
    waitingForHero: true,
    villainActedThisStreet: false,
    heroActedThisStreet: false,
    facingBet: spotType === "3-Bet",
    facingBetAmount: spotType === "3-Bet" ? 2.5 : 0,
    heroBetThisStreet: 0,
    villainBetThisStreet: spotType === "3-Bet" ? 2.5 : 0,
    startingStack: stack,
  };
}

// ── Opponent AI ──────────────────────────────────────────────────
function opponentDecision(
  street: Street,
  facingBet: boolean,
  betAmount: number,
  potSize: number,
): "fold" | "check" | "call" | "bet" | "raise" {
  const r = Math.random() * 100;

  if (street === "preflop") {
    if (facingBet) {
      // Facing hero raise preflop
      if (r < 55) return "fold";
      if (r < 90) return "call";
      return "raise";
    }
    return "check"; // BB checks
  }

  if (facingBet) {
    // Facing hero bet postflop
    if (r < 40) return "fold";
    if (r < 85) return "call";
    return "raise";
  }

  // Acting first (no bet to face)
  if (street === "flop") {
    if (r < 60) return "check";
    return "bet";
  }
  if (street === "turn") {
    if (r < 70) return "check";
    return "bet";
  }
  // River
  if (r < 80) return "check";
  return "bet";
}

function getOpponentBetSize(potSize: number, street: Street): number {
  // Randomize between common sizings
  const r = Math.random();
  if (street === "flop") {
    if (r < 0.5) return Math.round(potSize * 0.33 * 10) / 10;
    if (r < 0.8) return Math.round(potSize * 0.5 * 10) / 10;
    return Math.round(potSize * 0.75 * 10) / 10;
  }
  if (street === "turn") {
    if (r < 0.4) return Math.round(potSize * 0.5 * 10) / 10;
    if (r < 0.7) return Math.round(potSize * 0.66 * 10) / 10;
    return Math.round(potSize * 0.75 * 10) / 10;
  }
  // River
  if (r < 0.4) return Math.round(potSize * 0.5 * 10) / 10;
  if (r < 0.7) return Math.round(potSize * 0.75 * 10) / 10;
  return Math.round(potSize * 1.0 * 10) / 10;
}

// ── GTO Postflop Guidance ────────────────────────────────────────
function getPostflopGuidance(
  street: Street,
  handEval: HandEvaluation,
  boardTexture: BoardTexture,
  draws: string[],
  heroIsIP: boolean,
  facingBet: boolean,
): string {
  if (street === "flop") {
    if (facingBet) {
      if (handEval.strength >= 4) return `Strong hand (${handEval.description}). Raise for value or call to trap.`;
      if (handEval.strength >= 2.5) return `Decent hand (${handEval.description}). Calling is standard.`;
      if (draws.length > 0) return `Drawing hand (${draws.join(", ")}). Call if getting odds, fold otherwise.`;
      return `Weak hand (${handEval.description}). Consider folding vs this bet size.`;
    }
    // Not facing bet
    if (handEval.strength >= 4) return `Strong hand (${handEval.description}). ${heroIsIP ? "Bet for value" : "Check-raise or lead for value"}.`;
    if (handEval.strength >= 2) return `${boardTexture.cbetFrequency}. ${boardTexture.advice}`;
    if (draws.length > 0) return `Drawing hand (${draws.join(", ")}). Good semi-bluff candidate.`;
    return `Weak hand. ${boardTexture.type === "Dry" ? "Can c-bet as a bluff on this dry board." : "Better to check and give up."}`;
  }

  if (street === "turn") {
    if (facingBet) {
      if (handEval.strength >= 4) return `Strong hand. Continue for value -- raise or call.`;
      if (handEval.strength >= 2.5) return `Decent hand (${handEval.description}). Calling is reasonable.`;
      if (draws.length > 0) return `Drawing hand. Calculate pot odds before calling.`;
      return `Weak hand. Likely a fold unless very small bet.`;
    }
    if (handEval.strength >= 4) return `Strong hand. Keep barreling for value.`;
    if (handEval.strength >= 2.5) return `Decent hand. Bet ~55% of the time for thin value/protection.`;
    return `Weak hand. Check and evaluate river.`;
  }

  // River
  if (facingBet) {
    if (handEval.strength >= 4) return `Strong hand. Raise for max value.`;
    if (handEval.strength >= 2.5) return `Decent hand. Call -- this is a bluff-catching spot.`;
    return `Weak hand. Fold unless you have a specific read.`;
  }
  if (handEval.strength >= 4) return `Strong hand (${handEval.description}). Value bet -- go for 66-100% pot.`;
  if (handEval.strength >= 2.5) return `Thin value spot (${handEval.description}). Consider 33-50% pot bet.`;
  if (handEval.strength <= 0.5 && draws.length === 0) return `Missed draw / air. Bluff candidate at 50-75% pot.`;
  return `Marginal hand. Check and showdown.`;
}

// ── Showdown winner (simplified) ─────────────────────────────────
function determineWinner(
  heroCards: [Card, Card],
  villainCards: [Card, Card],
  board: Card[],
): "hero" | "villain" | "split" {
  const heroEval = evaluateHand(heroCards, board);
  const villainEval = evaluateHand(villainCards, board);

  if (heroEval.strength > villainEval.strength) return "hero";
  if (villainEval.strength > heroEval.strength) return "villain";

  // Tie-break by high card
  const heroVals = heroCards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const villainVals = villainCards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  if (heroVals[0] > villainVals[0]) return "hero";
  if (villainVals[0] > heroVals[0]) return "villain";
  if (heroVals[1] > villainVals[1]) return "hero";
  if (villainVals[1] > heroVals[1]) return "villain";
  return "split";
}

// ── Suit symbol helpers ─────────────────────────────────────────────
const SUIT_SYM: Record<string, string> = { s: "\u2660", h: "\u2665", d: "\u2666", c: "\u2663" };
const SUIT_CLR: Record<string, string> = { s: "text-gray-400", h: "text-red-400", d: "text-blue-400", c: "text-green-400" };

function CardInline({ card }: { card: Card }) {
  return (
    <span className={`${SUIT_CLR[card.suit]} font-bold`}>
      {card.rank}{SUIT_SYM[card.suit]}
    </span>
  );
}

function BoardInline({ cards }: { cards: Card[] }) {
  return (
    <span>
      [
      {cards.map((c, i) => (
        <span key={i}>
          {i > 0 && " "}
          <CardInline card={c} />
        </span>
      ))}
      ]
    </span>
  );
}

// ── Settings Panel ──────────────────────────────────────────────────
function SettingsPanel({
  settings,
  onChange,
  isOpen,
  onToggle,
}: {
  settings: TrainerSettings;
  onChange: (s: TrainerSettings) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const togglePosition = (pos: Position) => {
    onChange({
      ...settings,
      positions: { ...settings.positions, [pos]: !settings.positions[pos] },
    });
  };

  const toggleSpotType = (spot: SpotType) => {
    onChange({
      ...settings,
      spotTypes: { ...settings.spotTypes, [spot]: !settings.spotTypes[spot] },
    });
  };

  return (
    <div className="bg-gray-900/80 border-b border-gray-800">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-200 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          Settings
        </span>
        <span className="text-gray-600 font-normal normal-case">
          {settings.stackDepth}bb | {Object.values(settings.positions).filter(Boolean).length} positions
        </span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in">
          {/* Position Filter */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2 block">
              Positions
            </label>
            <div className="flex gap-2 flex-wrap">
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => togglePosition(pos)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    settings.positions[pos]
                      ? "bg-emerald-600/80 text-white border border-emerald-500/40"
                      : "bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300"
                  }`}
                >
                  {pos}
                </button>
              ))}
              <button
                onClick={() => {
                  const allOn = Object.values(settings.positions).every(Boolean);
                  const newPositions = {} as Record<Position, boolean>;
                  for (const p of POSITIONS) newPositions[p] = !allOn;
                  onChange({ ...settings, positions: newPositions });
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700 hover:text-white transition-all"
              >
                {Object.values(settings.positions).every(Boolean) ? "None" : "All"}
              </button>
            </div>
          </div>

          {/* Stack Depth */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2 block">
              Stack Depth
            </label>
            <div className="flex gap-2 flex-wrap">
              {STACK_DEPTHS.map((depth) => (
                <button
                  key={depth}
                  onClick={() => onChange({ ...settings, stackDepth: depth })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    settings.stackDepth === depth
                      ? "bg-blue-600/80 text-white border border-blue-500/40"
                      : "bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300"
                  }`}
                >
                  {depth}bb
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-6 flex-wrap">
            {/* Blind Structure */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2 block">
                Blinds
              </label>
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white font-mono">
                {settings.blinds}
              </div>
            </div>

            {/* Game Type */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2 block">
                Game Type
              </label>
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300">
                6-Max Cash
              </div>
            </div>

            {/* Speed */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2 block">
                Speed
              </label>
              <div className="flex gap-2">
                {(["normal", "fast"] as SpeedMode[]).map((spd) => (
                  <button
                    key={spd}
                    onClick={() => onChange({ ...settings, speed: spd })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                      settings.speed === spd
                        ? "bg-orange-600/80 text-white border border-orange-500/40"
                        : "bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300"
                    }`}
                  >
                    {spd}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Spot Types */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2 block">
              Spot Types
            </label>
            <div className="flex gap-2 flex-wrap">
              {(["RFI", "3-Bet"] as SpotType[]).map((spot) => (
                <button
                  key={spot}
                  onClick={() => toggleSpotType(spot)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    settings.spotTypes[spot]
                      ? "bg-purple-600/80 text-white border border-purple-500/40"
                      : "bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300"
                  }`}
                >
                  {spot === "RFI" ? "Open Raise (RFI)" : "3-Bet Pots"}
                </button>
              ))}
            </div>
          </div>

          {/* Starting Street */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2 block">
              Starting Street
            </label>
            <div className="flex gap-2 flex-wrap">
              {(["preflop", "flop", "turn", "river"] as StartingStreet[]).map((st) => (
                <button
                  key={st}
                  onClick={() => onChange({ ...settings, startingStreet: st })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                    settings.startingStreet === st
                      ? "bg-cyan-600/80 text-white border border-cyan-500/40"
                      : "bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Range Grid (mini, inline) ───────────────────────────────────────
function MiniRangeGrid({
  grid,
  highlightHand,
  correct,
}: {
  grid: Record<string, number>;
  highlightHand: string;
  correct: boolean;
}) {
  return (
    <div className="inline-block">
      <div className="grid grid-cols-13 gap-[1px]">
        {RANKS.map((_, row) =>
          RANKS.map((_, col) => {
            const hand = getHandKey(row, col);
            const freq = grid[hand] ?? 0;
            const isHighlighted = hand === highlightHand;
            const bgColor = isHighlighted
              ? correct
                ? "bg-emerald-500"
                : "bg-red-500"
              : getFrequencyColor(freq);

            return (
              <div
                key={`${row}-${col}`}
                className={`w-[22px] h-[22px] text-[7px] ${bgColor} flex items-center justify-center rounded-[2px] font-mono font-medium ${
                  isHighlighted ? "ring-2 ring-white z-10 scale-110" : ""
                } ${isPair(row, col) && !isHighlighted ? "ring-[0.5px] ring-white/10" : ""}`}
                title={`${hand}: ${freq}%`}
              >
                <span className={`${freq > 0 || isHighlighted ? "text-white" : "text-gray-600"} leading-none`}>
                  {hand}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Action History Bar ──────────────────────────────────────────────
function ActionHistoryBar({ hand }: { hand: HandState }) {
  const segments: { type: "action" | "divider"; text: string; street: Street }[] = [];

  // Preflop actions
  for (const a of hand.streetActions.preflop) {
    segments.push({ type: "action", text: `${a.position} ${a.action}`, street: "preflop" });
  }

  // Flop divider + actions
  if (hand.visibleBoard.length >= 3) {
    segments.push({
      type: "divider",
      text: `FLOP`,
      street: "flop",
    });
    for (const a of hand.streetActions.flop) {
      segments.push({ type: "action", text: `${a.position} ${a.action}`, street: "flop" });
    }
  }

  // Turn divider + actions
  if (hand.visibleBoard.length >= 4) {
    segments.push({
      type: "divider",
      text: `TURN`,
      street: "turn",
    });
    for (const a of hand.streetActions.turn) {
      segments.push({ type: "action", text: `${a.position} ${a.action}`, street: "turn" });
    }
  }

  // River divider + actions
  if (hand.visibleBoard.length >= 5) {
    segments.push({
      type: "divider",
      text: `RIVER`,
      street: "river",
    });
    for (const a of hand.streetActions.river) {
      segments.push({ type: "action", text: `${a.position} ${a.action}`, street: "river" });
    }
  }

  if (segments.length === 0) return null;

  return (
    <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-2 flex items-center gap-1 overflow-x-auto text-xs font-mono whitespace-nowrap scrollbar-thin">
      <span className="text-gray-600 mr-2 text-[10px] font-sans font-semibold uppercase">
        {hand.spotType === "3-Bet" ? "3-BET" : "RFI"}
      </span>
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && seg.type === "action" && <span className="text-gray-700 mx-0.5">|</span>}
          {seg.type === "divider" ? (
            <span className={`mx-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
              seg.street === "flop" ? "bg-emerald-900/50 text-emerald-400" :
              seg.street === "turn" ? "bg-blue-900/50 text-blue-400" :
              "bg-purple-900/50 text-purple-400"
            }`}>
              {seg.text}
            </span>
          ) : (
            <span className={`${
              seg.street === hand.street ? "text-yellow-400" : "text-gray-500"
            }`}>
              {seg.text}
            </span>
          )}
        </span>
      ))}
      {hand.waitingForHero && !hand.handComplete && (
        <>
          <span className="text-gray-700 mx-0.5">|</span>
          <span className="text-yellow-400 font-bold animate-pulse">{hand.heroPosition} to act</span>
        </>
      )}
    </div>
  );
}

// ── Board Texture Display ───────────────────────────────────────────
function BoardTexturePanel({ boardTexture, draws, handEval }: {
  boardTexture: BoardTexture;
  draws: string[];
  handEval: HandEvaluation;
}) {
  return (
    <div className="bg-gray-800/60 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Board texture badge */}
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
          boardTexture.type === "Dry" ? "bg-gray-700 text-gray-300" :
          boardTexture.type === "Semi-wet" ? "bg-yellow-900/60 text-yellow-300" :
          "bg-red-900/60 text-red-300"
        }`}>
          {boardTexture.type}
        </span>
        {boardTexture.flushDraw && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-900/60 text-blue-300">Flush Draw Possible</span>
        )}
        {boardTexture.flushComplete && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-700/60 text-blue-200">Flush Complete</span>
        )}
        {boardTexture.straightDraw && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-900/60 text-orange-300">Straight Draw Possible</span>
        )}
        {boardTexture.paired && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-700 text-gray-300">Paired</span>
        )}
      </div>

      {/* Hand strength */}
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-xs">Hand:</span>
        <span className={`text-xs font-bold ${
          handEval.strength >= 4 ? "text-emerald-400" :
          handEval.strength >= 2 ? "text-yellow-400" :
          handEval.strength >= 1 ? "text-orange-400" :
          "text-red-400"
        }`}>
          {handEval.rank} - {handEval.description}
        </span>
      </div>

      {/* Draws */}
      {draws.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">Draws:</span>
          <span className="text-cyan-400 text-xs font-semibold">{draws.join(", ")}</span>
        </div>
      )}
    </div>
  );
}

// ── Feedback Banner ─────────────────────────────────────────────────
const RATING_CONFIG: Record<FeedbackRating, {
  label: string;
  border: string;
  bg: string;
  icon: string;
  iconColor: string;
  labelColor: string;
  gtoColor: string;
}> = {
  perfect: {
    label: "Perfect",
    border: "border-emerald-500",
    bg: "bg-emerald-950/60",
    icon: "\u2713",
    iconColor: "text-emerald-400",
    labelColor: "text-emerald-400",
    gtoColor: "text-emerald-400",
  },
  good: {
    label: "Good",
    border: "border-yellow-500",
    bg: "bg-yellow-950/40",
    icon: "~",
    iconColor: "text-yellow-400",
    labelColor: "text-yellow-400",
    gtoColor: "text-yellow-400",
  },
  bad: {
    label: "Bad",
    border: "border-red-500",
    bg: "bg-red-950/60",
    icon: "\u2717",
    iconColor: "text-red-400",
    labelColor: "text-red-400",
    gtoColor: "text-red-400",
  },
};

function FeedbackBanner({
  feedback,
  onDismiss,
}: {
  feedback: ActionFeedback;
  onDismiss: () => void;
}) {
  const cfg = RATING_CONFIG[feedback.rating];

  return (
    <div
      onClick={onDismiss}
      className={`mx-4 mb-1 rounded-xl border-l-4 ${cfg.border} ${cfg.bg} px-4 py-3 cursor-pointer transition-all animate-fade-in`}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <span className={`text-2xl font-black ${cfg.iconColor} leading-none`}>{cfg.icon}</span>
          <span className={`text-[10px] font-black uppercase tracking-wider ${cfg.labelColor}`}>{cfg.label}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="text-xs text-gray-400">
              Your action: <span className="text-white font-bold">{feedback.yourAction}</span>
            </span>
            <span className="text-gray-600 text-xs">|</span>
            <span className="text-xs text-gray-400">
              GTO recommends: <span className={`font-bold ${cfg.gtoColor}`}>{feedback.gtoAction}</span>
            </span>
          </div>
          <p className="text-[11px] text-gray-400 leading-snug">{feedback.explanation}</p>
          <span className="text-[9px] text-gray-600 uppercase tracking-wider">{feedback.street} · click to dismiss</span>
        </div>
      </div>
    </div>
  );
}

// ── Result Screen ───────────────────────────────────────────────────
function ResultScreen({
  hand,
  onNext,
  actionFeedbacks,
}: {
  hand: HandState;
  onNext: () => void;
  actionFeedbacks: ActionFeedback[];
}) {
  const heroEval = evaluateHand(hand.heroCards, hand.visibleBoard);
  const villainEval = evaluateHand(hand.villainCards, hand.visibleBoard);
  const won = hand.heroWon === true;
  const split = hand.heroWon === null && hand.showdownReached;

  return (
    <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col animate-fade-in">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 max-w-lg mx-auto shadow-2xl">
          {/* Result header — compact */}
          <div className="flex items-center gap-3 mb-3">
            <div className={`text-3xl ${won ? "text-emerald-400" : hand.heroFolded ? "text-gray-400" : hand.villainFolded ? "text-emerald-400" : "text-red-400"}`}>
              {won ? "\u2713" : hand.heroFolded ? "-" : hand.villainFolded ? "\u2713" : "\u2717"}
            </div>
            <div>
              <h3 className={`text-base font-black ${
                won ? "text-emerald-400" :
                hand.heroFolded ? "text-gray-300" :
                hand.villainFolded ? "text-emerald-400" :
                "text-red-400"
              }`}>
                {hand.heroFolded ? "You folded" :
                 hand.villainFolded ? "Opponent folded — You win!" :
                 won ? "You win at showdown!" :
                 split ? "Split pot" :
                 "You lose at showdown"}
              </h3>
              <span className={`text-sm font-black ${
                hand.bbWon > 0 ? "text-emerald-400" :
                hand.bbWon < 0 ? "text-red-400" :
                "text-gray-400"
              }`}>
                {hand.bbWon > 0 ? "+" : ""}{hand.bbWon.toFixed(1)}bb
              </span>
            </div>
          </div>

          {/* Board — inline */}
          {hand.visibleBoard.length > 0 && (
            <div className="mb-2">
              <span className="text-gray-500 text-xs">Board: </span>
              <BoardInline cards={hand.visibleBoard} />
            </div>
          )}

          {/* Hands comparison — compact row */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className={`rounded-lg px-3 py-2 border ${won ? "bg-emerald-950/30 border-emerald-800/40" : "bg-gray-800/60 border-gray-700/40"}`}>
              <div className="text-[10px] text-gray-500">Hero ({hand.heroPosition})</div>
              <div className="flex gap-1 items-center">
                <CardInline card={hand.heroCards[0]} /> <CardInline card={hand.heroCards[1]} />
                {hand.visibleBoard.length > 0 && (
                  <span className="text-[9px] text-gray-400 ml-1">{heroEval.description}</span>
                )}
              </div>
            </div>
            {hand.showdownReached ? (
              <div className={`rounded-lg px-3 py-2 border ${!won && !hand.heroFolded ? "bg-red-950/30 border-red-800/40" : "bg-gray-800/60 border-gray-700/40"}`}>
                <div className="text-[10px] text-gray-500">Villain ({hand.villainPosition})</div>
                <div className="flex gap-1 items-center">
                  <CardInline card={hand.villainCards[0]} /> <CardInline card={hand.villainCards[1]} />
                  {hand.visibleBoard.length > 0 && (
                    <span className="text-[9px] text-gray-400 ml-1">{villainEval.description}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg px-3 py-2 border bg-gray-800/60 border-gray-700/40">
                <div className="text-[10px] text-gray-500">Villain ({hand.villainPosition})</div>
                <div className="text-gray-600 text-xs">{hand.villainFolded ? "Folded" : "Mucked"}</div>
              </div>
            )}
          </div>

          {/* Action Log with Feedback — this is what the user cares about most */}
          {actionFeedbacks.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] text-gray-500 font-semibold mb-1.5 uppercase tracking-wider">Action Review</div>
              <div className="space-y-1">
                {actionFeedbacks.map((fb, i) => {
                  const cfg = RATING_CONFIG[fb.rating];
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border-l-2 ${cfg.border} ${cfg.bg}`}
                    >
                      <span className={`text-xs font-black ${cfg.iconColor} min-w-[50px] text-center`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-gray-500 uppercase font-bold">{fb.street}</span>
                          <span className="text-white font-semibold">{fb.yourAction}</span>
                          <span className="text-gray-600">→</span>
                          <span className={`font-semibold ${cfg.gtoColor}`}>GTO: {fb.gtoAction}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preflop GTO info — compact */}
          <div className="bg-gray-800/60 rounded-lg p-2.5 mb-3 space-y-1.5">
            <div className="text-[10px] text-gray-500 font-semibold">{hand.rangeScenario}</div>
            <div className="text-[10px] text-gray-300">{hand.explanation}</div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-[10px] w-10 text-right">Raise</span>
              <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${hand.gtoFrequency}%` }} />
              </div>
              <span className="text-white text-[10px] font-bold w-8">{hand.gtoFrequency}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-[10px] w-10 text-right">Fold</span>
              <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gray-500 rounded-full" style={{ width: `${hand.foldFrequency}%` }} />
              </div>
              <span className="text-white text-[10px] font-bold w-8">{Math.round(hand.foldFrequency)}%</span>
            </div>
          </div>

          {/* Mini range grid — collapsed by default */}
          {Object.keys(hand.rangeGrid).length > 0 && (
            <details className="mb-3">
              <summary className="text-[10px] text-gray-500 font-semibold cursor-pointer hover:text-gray-300 transition-colors">
                Show Range Grid ({hand.heroPosition} {hand.spotType === "3-Bet" ? "3-Bet" : "RFI"})
              </summary>
              <div className="mt-2 flex justify-center">
                <MiniRangeGrid
                  grid={hand.rangeGrid}
                  highlightHand={hand.handKey}
                  correct={hand.heroWon === true || hand.villainFolded}
                />
              </div>
              <div className="flex gap-2 items-center justify-center mt-2 text-[9px] text-gray-500">
                {[0, 20, 50, 80, 100].map((f) => (
                  <div key={f} className="flex items-center gap-0.5">
                    <div className={`w-2.5 h-2.5 rounded-sm ${getFrequencyColor(f)}`} />
                    <span>{f}%</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Sticky bottom button */}
      <div className="shrink-0 px-4 pb-3 pt-2 bg-gradient-to-t from-black/90 to-transparent">
        <button
          onClick={onNext}
          className="w-full max-w-lg mx-auto block py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all active:scale-95"
        >
          Deal Next Hand
        </button>
      </div>
    </div>
  );
}

// ── Session Stats Panel ─────────────────────────────────────────────
function SessionStatsPanel({
  stats,
  isOpen,
  onToggle,
  onReset,
}: {
  stats: SessionStats;
  isOpen: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

  const mistakeCounts = new Map<string, number>();
  for (const m of stats.mistakes) {
    const key = `${m.handKey} (${m.position})`;
    mistakeCounts.set(key, (mistakeCounts.get(key) ?? 0) + 1);
  }
  const topMistakes = [...mistakeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="bg-gray-900/80 border-t border-gray-800">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-200 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          Session Stats
        </span>
        <div className="flex items-center gap-3 font-normal normal-case">
          <span className="text-gray-500">{stats.total} hands</span>
          {stats.total > 0 && (
            <>
              <span className={`font-bold ${stats.totalBBWon >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {stats.totalBBWon >= 0 ? "+" : ""}{stats.totalBBWon.toFixed(1)}bb
              </span>
              <span className={`font-bold ${accuracy >= 70 ? "text-emerald-400" : accuracy >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                {accuracy}%
              </span>
            </>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in">
          <div className="grid grid-cols-5 gap-2">
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-white">{stats.total}</div>
              <div className="text-[9px] text-gray-500 uppercase">Hands</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-emerald-400">{stats.handsWon}</div>
              <div className="text-[9px] text-gray-500 uppercase">Won</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-red-400">{stats.handsLost}</div>
              <div className="text-[9px] text-gray-500 uppercase">Lost</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className={`text-lg font-bold ${stats.totalBBWon >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {stats.totalBBWon >= 0 ? "+" : ""}{stats.totalBBWon.toFixed(1)}
              </div>
              <div className="text-[9px] text-gray-500 uppercase">BB Won</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-orange-400">{stats.bestStreak}</div>
              <div className="text-[9px] text-gray-500 uppercase">Best Streak</div>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wider">Accuracy by Position</div>
            <div className="grid grid-cols-6 gap-1.5">
              {POSITIONS.map((pos) => {
                const ps = stats.perPosition[pos];
                const posAcc = ps.total > 0 ? Math.round((ps.correct / ps.total) * 100) : -1;
                return (
                  <div key={pos} className="bg-gray-800/60 rounded-lg p-2 text-center">
                    <div className="text-[10px] text-gray-400 font-bold mb-0.5">{pos}</div>
                    <div className={`text-sm font-bold ${
                      posAcc < 0 ? "text-gray-600" :
                      posAcc >= 70 ? "text-emerald-400" :
                      posAcc >= 50 ? "text-yellow-400" : "text-red-400"
                    }`}>
                      {posAcc < 0 ? "--" : `${posAcc}%`}
                    </div>
                    <div className="text-[8px] text-gray-600">{ps.total > 0 ? `${ps.correct}/${ps.total}` : ""}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {topMistakes.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wider">Common Mistakes</div>
              <div className="space-y-1">
                {topMistakes.map(([hand, count], i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-3 py-1.5">
                    <span className="text-red-300 text-xs font-mono font-bold">{hand}</span>
                    <span className="text-gray-500 text-xs">{count}x wrong</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onReset}
            className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs font-semibold rounded-lg transition-all border border-gray-700"
          >
            Reset Session
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function TrainerPage() {
  const [settings, setSettings] = useState<TrainerSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [hand, setHand] = useState<HandState>(() => generateHand(DEFAULT_SETTINGS));
  const [sessionStats, setSessionStats] = useState<SessionStats>(emptySessionStats);
  const [gtoAdvice, setGtoAdvice] = useState<string>("");
  const [actionFeedbacks, setActionFeedbacks] = useState<ActionFeedback[]>([]);
  const [showFeedback, setShowFeedback] = useState<ActionFeedback | null>(null);
  const opponentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute board analysis
  const boardTexture = useMemo(() => analyzeBoardTexture(hand.visibleBoard), [hand.visibleBoard]);
  const handEval = useMemo(() => evaluateHand(hand.heroCards, hand.visibleBoard), [hand.heroCards, hand.visibleBoard]);
  const draws = useMemo(() => analyzeDraws(hand.heroCards, hand.visibleBoard), [hand.heroCards, hand.visibleBoard]);

  // Regenerate when settings change (only if not mid-hand)
  const handleSettingsChange = useCallback((newSettings: TrainerSettings) => {
    setSettings(newSettings);
    if (hand.street === "preflop" && !hand.heroActedThisStreet && !hand.handComplete) {
      const newHand = generateHand(newSettings);
      // Handle starting street
      if (newSettings.startingStreet !== "preflop") {
        advanceToStreet(newHand, newSettings.startingStreet);
      }
      setHand(newHand);
      setGtoAdvice("");
      setActionFeedbacks([]);
      setShowFeedback(null);
    }
  }, [hand]);

  // Advance hand to a later street (for starting street setting)
  function advanceToStreet(h: HandState, target: StartingStreet) {
    // Simulate preflop action: hero raises, villain calls
    if (target === "preflop") return;

    // Hero raised preflop
    const raiseAmt = h.spotType === "3-Bet" ? 7.5 : 2.5;
    h.stacks[h.heroPosition] -= raiseAmt;
    h.potSize += raiseAmt;
    h.streetActions.preflop.push({ position: h.heroPosition, stack: h.stacks[h.heroPosition], action: `Raise ${raiseAmt}`, street: "preflop" });

    // Villain calls
    const callAmt = raiseAmt - h.villainBetThisStreet;
    h.stacks[h.villainPosition] -= callAmt;
    h.potSize += callAmt;
    h.streetActions.preflop.push({ position: h.villainPosition, stack: h.stacks[h.villainPosition], action: "Call", street: "preflop" });

    // Move to flop
    h.street = "flop";
    h.visibleBoard = h.boardCards.slice(0, 3);
    h.heroBetThisStreet = 0;
    h.villainBetThisStreet = 0;
    h.facingBet = false;
    h.facingBetAmount = 0;
    h.heroActedThisStreet = false;
    h.villainActedThisStreet = false;

    if (target === "flop") {
      // Set who acts first
      if (!h.heroIsIP) {
        h.waitingForHero = true;
      } else {
        h.waitingForHero = false;
        // Villain acts first
      }
      return;
    }

    // Simulate flop: both check
    h.streetActions.flop.push({ position: h.heroIsIP ? h.villainPosition : h.heroPosition, stack: 0, action: "Check", street: "flop" });
    h.streetActions.flop.push({ position: h.heroIsIP ? h.heroPosition : h.villainPosition, stack: 0, action: "Check", street: "flop" });

    // Move to turn
    h.street = "turn";
    h.visibleBoard = h.boardCards.slice(0, 4);
    h.heroBetThisStreet = 0;
    h.villainBetThisStreet = 0;
    h.facingBet = false;
    h.facingBetAmount = 0;
    h.heroActedThisStreet = false;
    h.villainActedThisStreet = false;

    if (target === "turn") {
      if (!h.heroIsIP) {
        h.waitingForHero = true;
      } else {
        h.waitingForHero = false;
      }
      return;
    }

    // Simulate turn: both check
    h.streetActions.turn.push({ position: h.heroIsIP ? h.villainPosition : h.heroPosition, stack: 0, action: "Check", street: "turn" });
    h.streetActions.turn.push({ position: h.heroIsIP ? h.heroPosition : h.villainPosition, stack: 0, action: "Check", street: "turn" });

    // Move to river
    h.street = "river";
    h.visibleBoard = h.boardCards.slice(0, 5);
    h.heroBetThisStreet = 0;
    h.villainBetThisStreet = 0;
    h.facingBet = false;
    h.facingBetAmount = 0;
    h.heroActedThisStreet = false;
    h.villainActedThisStreet = false;

    if (!h.heroIsIP) {
      h.waitingForHero = true;
    } else {
      h.waitingForHero = false;
    }
  }

  // Process opponent action
  const processOpponentAction = useCallback((currentHand: HandState) => {
    const h = { ...currentHand };
    h.stacks = { ...currentHand.stacks };
    h.streetActions = {
      preflop: [...currentHand.streetActions.preflop],
      flop: [...currentHand.streetActions.flop],
      turn: [...currentHand.streetActions.turn],
      river: [...currentHand.streetActions.river],
    };
    h.actionHistory = [...currentHand.actionHistory];
    h.players = currentHand.players.map((p) => ({ ...p }));

    const decision = opponentDecision(
      h.street,
      h.heroBetThisStreet > 0,
      h.heroBetThisStreet,
      h.potSize,
    );

    const villainPlayer = h.players.find((p) => p.position === h.villainPosition);

    if (decision === "fold") {
      if (villainPlayer) {
        villainPlayer.hasFolded = true;
        villainPlayer.lastAction = "Fold";
        villainPlayer.isActive = false;
      }
      h.streetActions[h.street].push({ position: h.villainPosition, stack: h.stacks[h.villainPosition], action: "Fold", street: h.street });
      h.villainFolded = true;
      h.handComplete = true;
      h.heroWon = true;
      h.waitingForHero = false;
      // Calculate BB won
      const invested = h.startingStack - h.stacks[h.heroPosition];
      h.bbWon = h.potSize - invested;
      setHand(h);
      return;
    }

    if (decision === "check") {
      if (villainPlayer) villainPlayer.lastAction = "Check";
      h.streetActions[h.street].push({ position: h.villainPosition, stack: h.stacks[h.villainPosition], action: "Check", street: h.street });
      h.villainActedThisStreet = true;

      // If hero has also acted (checked), move to next street
      if (h.heroActedThisStreet) {
        moveToNextStreet(h);
      } else {
        // Hero's turn
        h.waitingForHero = true;
        h.facingBet = false;
        h.facingBetAmount = 0;
      }
      setHand(h);
      return;
    }

    if (decision === "call") {
      const callAmt = h.heroBetThisStreet - h.villainBetThisStreet;
      const actualCall = Math.min(callAmt, h.stacks[h.villainPosition]);
      h.stacks[h.villainPosition] -= actualCall;
      h.potSize += actualCall;
      h.villainBetThisStreet += actualCall;
      if (villainPlayer) {
        villainPlayer.stack = h.stacks[h.villainPosition];
        villainPlayer.lastAction = "Call";
        villainPlayer.currentBet = h.villainBetThisStreet;
      }
      h.streetActions[h.street].push({ position: h.villainPosition, stack: h.stacks[h.villainPosition], action: "Call", street: h.street });
      h.villainActedThisStreet = true;

      // Both have acted, move to next street
      moveToNextStreet(h);
      setHand(h);
      return;
    }

    if (decision === "bet") {
      const betSize = getOpponentBetSize(h.potSize, h.street);
      const actualBet = Math.min(betSize, h.stacks[h.villainPosition]);
      h.stacks[h.villainPosition] -= actualBet;
      h.potSize += actualBet;
      h.villainBetThisStreet = actualBet;
      if (villainPlayer) {
        villainPlayer.stack = h.stacks[h.villainPosition];
        villainPlayer.lastAction = `Bet ${actualBet.toFixed(1)}`;
        villainPlayer.currentBet = actualBet;
      }
      h.streetActions[h.street].push({ position: h.villainPosition, stack: h.stacks[h.villainPosition], action: `Bet ${actualBet.toFixed(1)}`, street: h.street });
      h.villainActedThisStreet = true;
      h.facingBet = true;
      h.facingBetAmount = actualBet;
      h.waitingForHero = true;
      setHand(h);
      return;
    }

    if (decision === "raise") {
      const raiseSize = h.heroBetThisStreet * 2.5;
      const actualRaise = Math.min(raiseSize, h.stacks[h.villainPosition] + h.villainBetThisStreet);
      const additional = actualRaise - h.villainBetThisStreet;
      h.stacks[h.villainPosition] -= additional;
      h.potSize += additional;
      h.villainBetThisStreet = actualRaise;
      if (villainPlayer) {
        villainPlayer.stack = h.stacks[h.villainPosition];
        villainPlayer.lastAction = `Raise ${actualRaise.toFixed(1)}`;
        villainPlayer.currentBet = actualRaise;
      }
      h.streetActions[h.street].push({ position: h.villainPosition, stack: h.stacks[h.villainPosition], action: `Raise ${actualRaise.toFixed(1)}`, street: h.street });
      h.villainActedThisStreet = true;
      h.facingBet = true;
      h.facingBetAmount = actualRaise;
      h.waitingForHero = true;
      setHand(h);
      return;
    }
  }, []);

  function moveToNextStreet(h: HandState) {
    // Reset street bets and clear current bets on players
    h.players.forEach((p) => { p.currentBet = 0; });
    h.heroBetThisStreet = 0;
    h.villainBetThisStreet = 0;
    h.heroActedThisStreet = false;
    h.villainActedThisStreet = false;
    h.facingBet = false;
    h.facingBetAmount = 0;

    if (h.street === "preflop") {
      h.street = "flop";
      h.visibleBoard = h.boardCards.slice(0, 3);
    } else if (h.street === "flop") {
      h.street = "turn";
      h.visibleBoard = h.boardCards.slice(0, 4);
    } else if (h.street === "turn") {
      h.street = "river";
      h.visibleBoard = h.boardCards.slice(0, 5);
    } else {
      // River action complete -> showdown
      h.showdownReached = true;
      h.handComplete = true;
      h.waitingForHero = false;
      const winner = determineWinner(h.heroCards, h.villainCards, h.visibleBoard);
      h.heroWon = winner === "hero";
      const invested = h.startingStack - h.stacks[h.heroPosition];
      if (winner === "hero") {
        h.bbWon = h.potSize - invested;
      } else if (winner === "villain") {
        h.bbWon = -invested;
      } else {
        h.bbWon = h.potSize / 2 - invested;
      }
      return;
    }

    // Update last actions for new street display
    h.players.forEach((p) => {
      if (!p.hasFolded && p.position !== h.heroPosition && p.position !== h.villainPosition) {
        // Keep folded status
      } else if (!p.hasFolded) {
        p.lastAction = undefined;
      }
    });

    // Determine who acts first postflop
    if (h.heroIsIP) {
      // Villain acts first (OOP)
      h.waitingForHero = false;
    } else {
      // Hero acts first (OOP)
      h.waitingForHero = true;
    }
  }

  // Trigger opponent action when it's their turn
  useEffect(() => {
    if (hand.handComplete || hand.waitingForHero || hand.heroFolded || hand.villainFolded) return;

    const delay = settings.speed === "fast" ? 200 : 800;
    opponentTimerRef.current = setTimeout(() => {
      processOpponentAction(hand);
    }, delay);

    return () => {
      if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);
    };
  }, [hand, settings.speed, processOpponentAction]);

  // Update GTO advice whenever street/board changes
  useEffect(() => {
    if (hand.street === "preflop") {
      setGtoAdvice(hand.explanation);
    } else if (hand.visibleBoard.length > 0) {
      const bt = analyzeBoardTexture(hand.visibleBoard);
      const he = evaluateHand(hand.heroCards, hand.visibleBoard);
      const dr = analyzeDraws(hand.heroCards, hand.visibleBoard);
      const advice = getPostflopGuidance(hand.street, he, bt, dr, hand.heroIsIP, hand.facingBet);
      setGtoAdvice(advice);
    }
  }, [hand.street, hand.visibleBoard, hand.facingBet, hand.heroCards, hand.heroIsIP, hand.explanation]);

  // Auto-dismiss feedback banner
  useEffect(() => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (showFeedback) {
      const delay = settings.speed === "fast" ? 1500 : 3000;
      feedbackTimerRef.current = setTimeout(() => {
        setShowFeedback(null);
      }, delay);
    }
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [showFeedback, settings.speed]);

  // ── Hero actions ───────────────────────────────────────────────
  const heroAct = useCallback((action: string, amount?: number) => {
    if (!hand.waitingForHero || hand.handComplete) return;

    const h = { ...hand };
    h.stacks = { ...hand.stacks };
    h.streetActions = {
      preflop: [...hand.streetActions.preflop],
      flop: [...hand.streetActions.flop],
      turn: [...hand.streetActions.turn],
      river: [...hand.streetActions.river],
    };
    h.actionHistory = [...hand.actionHistory];
    h.players = hand.players.map((p) => ({ ...p }));

    const heroPlayer = h.players.find((p) => p.position === h.heroPosition);

    // Compute GTO recommendation and feedback for this action
    const gtoRec = getGTORecommendation(h.street, {
      gtoAction: h.gtoAction,
      gtoFrequency: h.gtoFrequency,
      heroIsIP: h.heroIsIP,
      facingBet: h.facingBet,
      facingBetAmount: h.facingBetAmount,
      potSize: h.potSize,
      heroCards: h.heroCards,
      visibleBoard: h.visibleBoard,
    });

    // Determine display name for the hero's action
    let heroActionDisplay = action.charAt(0).toUpperCase() + action.slice(1);
    if (action === "bet" && amount) heroActionDisplay = `Bet ${amount.toFixed(1)}`;
    if (action === "raise" && amount) heroActionDisplay = `Raise ${amount.toFixed(1)}`;
    if (action === "allin") heroActionDisplay = "All-in";

    // Compute hand strength & draws for rating
    const evalForRating = evaluateHand(h.heroCards, h.visibleBoard);
    const drawsForRating = analyzeDraws(h.heroCards, h.visibleBoard);
    const hasDrawsForRating = drawsForRating.some((d) =>
      d.toLowerCase().includes("flush draw") || d.toLowerCase().includes("open-ended") || d.toLowerCase().includes("gutshot")
    );

    const actionRating = rateAction(
      heroActionDisplay,
      gtoRec.action,
      h.street,
      evalForRating.strength,
      hasDrawsForRating,
      h.facingBet,
      h.street === "preflop" ? h.gtoFrequency : undefined,
    );
    const feedback: ActionFeedback = {
      rating: actionRating,
      yourAction: heroActionDisplay,
      gtoAction: gtoRec.action,
      explanation: gtoRec.explanation,
      street: h.street,
      timestamp: Date.now(),
    };
    setActionFeedbacks((prev) => [...prev, feedback]);
    setShowFeedback(feedback);

    if (action === "fold") {
      if (heroPlayer) {
        heroPlayer.hasFolded = true;
        heroPlayer.lastAction = "Fold";
        heroPlayer.isActive = false;
      }
      h.streetActions[h.street].push({ position: h.heroPosition, stack: h.stacks[h.heroPosition], action: "Fold", street: h.street });
      h.heroFolded = true;
      h.handComplete = true;
      h.heroWon = false;
      h.waitingForHero = false;
      const invested = h.startingStack - h.stacks[h.heroPosition];
      h.bbWon = -invested;

      // Track preflop accuracy using rating
      setSessionStats((prev) => {
        const newStats = { ...prev };
        newStats.total += 1;
        const isCorrect = actionRating !== "bad";
        newStats.correct += isCorrect ? 1 : 0;
        newStats.streak = isCorrect ? prev.streak + 1 : 0;
        newStats.bestStreak = Math.max(newStats.bestStreak, newStats.streak);
        newStats.handsLost += 1;
        newStats.totalBBWon += h.bbWon;
        newStats.perPosition = { ...prev.perPosition };
        newStats.perPosition[h.heroPosition] = {
          correct: prev.perPosition[h.heroPosition].correct + (isCorrect ? 1 : 0),
          total: prev.perPosition[h.heroPosition].total + 1,
        };
        if (actionRating === "bad") {
          newStats.mistakes = [...prev.mistakes, {
            handKey: h.handKey, position: h.heroPosition, scenario: h.rangeScenario,
            yourAction: "Fold", gtoAction: h.gtoAction,
          }];
        }
        return newStats;
      });

      setHand(h);
      return;
    }

    if (action === "check") {
      if (heroPlayer) heroPlayer.lastAction = "Check";
      h.streetActions[h.street].push({ position: h.heroPosition, stack: h.stacks[h.heroPosition], action: "Check", street: h.street });
      h.heroActedThisStreet = true;
      h.waitingForHero = false;

      if (h.villainActedThisStreet) {
        // Both checked, move to next street
        moveToNextStreet(h);
      }
      // Otherwise villain will act
      setHand(h);
      return;
    }

    if (action === "call") {
      const callAmt = h.facingBetAmount - h.heroBetThisStreet;
      const actualCall = Math.min(callAmt, h.stacks[h.heroPosition]);
      h.stacks[h.heroPosition] -= actualCall;
      h.potSize += actualCall;
      h.heroBetThisStreet += actualCall;
      if (heroPlayer) {
        heroPlayer.stack = h.stacks[h.heroPosition];
        heroPlayer.lastAction = "Call";
        heroPlayer.currentBet = h.heroBetThisStreet;
      }
      h.streetActions[h.street].push({ position: h.heroPosition, stack: h.stacks[h.heroPosition], action: "Call", street: h.street });
      h.heroActedThisStreet = true;
      h.waitingForHero = false;
      h.facingBet = false;

      if (h.street === "preflop" && h.spotType === "3-Bet") {
        // Called preflop 3-bet, move to flop
        moveToNextStreet(h);
      } else if (h.villainActedThisStreet) {
        // Villain bet, hero called, move to next street
        moveToNextStreet(h);
      }

      setHand(h);
      return;
    }

    if (action === "bet" && amount) {
      const betSize = Math.min(amount, h.stacks[h.heroPosition]);
      h.stacks[h.heroPosition] -= betSize;
      h.potSize += betSize;
      h.heroBetThisStreet = betSize;
      if (heroPlayer) {
        heroPlayer.stack = h.stacks[h.heroPosition];
        heroPlayer.lastAction = `Bet ${betSize.toFixed(1)}`;
        heroPlayer.currentBet = betSize;
      }
      h.streetActions[h.street].push({ position: h.heroPosition, stack: h.stacks[h.heroPosition], action: `Bet ${betSize.toFixed(1)}`, street: h.street });
      h.heroActedThisStreet = true;
      h.waitingForHero = false;
      setHand(h);
      return;
    }

    if (action === "raise" && amount) {
      const raiseTotal = Math.min(amount, h.stacks[h.heroPosition] + h.heroBetThisStreet);
      const additional = raiseTotal - h.heroBetThisStreet;
      h.stacks[h.heroPosition] -= additional;
      h.potSize += additional;
      h.heroBetThisStreet = raiseTotal;
      if (heroPlayer) {
        heroPlayer.stack = h.stacks[h.heroPosition];
        heroPlayer.lastAction = `Raise ${raiseTotal.toFixed(1)}`;
        heroPlayer.currentBet = raiseTotal;
      }
      h.streetActions[h.street].push({ position: h.heroPosition, stack: h.stacks[h.heroPosition], action: `Raise ${raiseTotal.toFixed(1)}`, street: h.street });
      h.heroActedThisStreet = true;
      h.waitingForHero = false;
      h.facingBet = false;

      if (h.street === "preflop") {
        const isCorrect = actionRating !== "bad";
        setSessionStats((prev) => {
          const newStats = { ...prev };
          newStats.perPosition = { ...prev.perPosition };
          newStats.perPosition[h.heroPosition] = {
            correct: prev.perPosition[h.heroPosition].correct + (isCorrect ? 1 : 0),
            total: prev.perPosition[h.heroPosition].total + 1,
          };
          newStats.correct += isCorrect ? 1 : 0;
          newStats.total += 1;
          newStats.streak = isCorrect ? prev.streak + 1 : 0;
          newStats.bestStreak = Math.max(newStats.bestStreak, newStats.streak);
          if (actionRating === "bad") {
            newStats.mistakes = [...prev.mistakes, {
              handKey: h.handKey, position: h.heroPosition, scenario: h.rangeScenario,
              yourAction: "Raise", gtoAction: h.gtoAction,
            }];
          }
          return newStats;
        });
      }

      setHand(h);
      return;
    }

    if (action === "allin") {
      const allinAmt = h.stacks[h.heroPosition];
      h.stacks[h.heroPosition] = 0;
      h.potSize += allinAmt;
      h.heroBetThisStreet += allinAmt;
      if (heroPlayer) {
        heroPlayer.stack = 0;
        heroPlayer.lastAction = "All-in";
        heroPlayer.currentBet = h.heroBetThisStreet;
      }
      h.streetActions[h.street].push({ position: h.heroPosition, stack: 0, action: "All-in", street: h.street });
      h.heroActedThisStreet = true;
      h.waitingForHero = false;
      h.facingBet = false;

      if (h.street === "preflop") {
        const isCorrect = actionRating !== "bad";
        setSessionStats((prev) => {
          const newStats = { ...prev };
          newStats.perPosition = { ...prev.perPosition };
          newStats.perPosition[h.heroPosition] = {
            correct: prev.perPosition[h.heroPosition].correct + (isCorrect ? 1 : 0),
            total: prev.perPosition[h.heroPosition].total + 1,
          };
          newStats.correct += isCorrect ? 1 : 0;
          newStats.total += 1;
          newStats.streak = isCorrect ? prev.streak + 1 : 0;
          newStats.bestStreak = Math.max(newStats.bestStreak, newStats.streak);
          if (actionRating === "bad") {
            newStats.mistakes = [...prev.mistakes, {
              handKey: h.handKey, position: h.heroPosition, scenario: h.rangeScenario,
              yourAction: "All-in", gtoAction: h.gtoAction,
            }];
          }
          return newStats;
        });
      }

      setHand(h);
      return;
    }
  }, [hand]);

  const nextHand = useCallback(() => {
    // If hand is complete but stats haven't been tracked for postflop hands
    if (hand.handComplete && !hand.heroFolded && hand.street !== "preflop") {
      setSessionStats((prev) => {
        const newStats = { ...prev };
        if (hand.heroWon) {
          newStats.handsWon += 1;
        } else {
          newStats.handsLost += 1;
        }
        newStats.totalBBWon += hand.bbWon;
        // Only count total/correct if not already counted in preflop
        if (hand.street === "preflop") {
          // Already counted
        }
        return newStats;
      });
    }

    const newHand = generateHand(settings);
    if (settings.startingStreet !== "preflop") {
      advanceToStreet(newHand, settings.startingStreet);
    }
    setHand(newHand);
    setGtoAdvice("");
    setActionFeedbacks([]);
    setShowFeedback(null);
  }, [settings, hand]);

  const resetSession = useCallback(() => {
    setSessionStats(emptySessionStats());
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // If hand is complete, N or Enter deals next
      if (hand.handComplete) {
        if (e.key === "Enter" || e.key === " " || e.key === "n" || e.key === "N") {
          e.preventDefault();
          nextHand();
        }
        return;
      }

      if (!hand.waitingForHero) return;

      const key = e.key.toLowerCase();

      if (key === "f" || key === "1") {
        e.preventDefault();
        if (hand.facingBet || hand.street === "preflop") heroAct("fold");
      } else if (key === "c" || key === "2") {
        e.preventDefault();
        if (hand.facingBet) {
          heroAct("call");
        } else {
          heroAct("check");
        }
      } else if (key === "b" || key === "3") {
        e.preventDefault();
        if (!hand.facingBet && hand.street !== "preflop") {
          const betAmt = Math.round(hand.potSize * 0.5 * 10) / 10;
          heroAct("bet", betAmt);
        }
      } else if (key === "r" || key === "4") {
        e.preventDefault();
        if (hand.street === "preflop") {
          const raiseAmt = hand.spotType === "3-Bet" ? 7.5 : 2.5;
          heroAct("raise", raiseAmt);
        } else if (hand.facingBet) {
          heroAct("raise", hand.facingBetAmount * 2.5);
        }
      } else if (key === "a" || key === "5") {
        e.preventDefault();
        heroAct("allin");
      } else if (key === "n") {
        e.preventDefault();
        // N for next only when hand is done
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hand, heroAct, nextHand]);

  // ── Derived state ──────────────────────────────────────────────
  const streetLabel = hand.street.toUpperCase();
  const canFold = hand.waitingForHero && (hand.facingBet || hand.street === "preflop");
  const canCheck = hand.waitingForHero && !hand.facingBet && hand.street !== "preflop";
  const canCall = hand.waitingForHero && hand.facingBet;
  const canBet = hand.waitingForHero && !hand.facingBet && hand.street !== "preflop";
  const canRaise = hand.waitingForHero && (hand.street === "preflop" || hand.facingBet);

  // Bet sizing options
  const potBetSizes = [
    { label: "33%", mult: 0.33 },
    { label: "50%", mult: 0.5 },
    { label: "75%", mult: 0.75 },
    { label: "100%", mult: 1.0 },
  ];

  return (
    <div className="relative min-h-screen bg-gray-950 flex flex-col select-none">
      {/* Settings Panel */}
      <SettingsPanel
        settings={settings}
        onChange={handleSettingsChange}
        isOpen={settingsOpen}
        onToggle={() => setSettingsOpen(!settingsOpen)}
      />

      {/* Action History Bar */}
      <ActionHistoryBar hand={hand} />

      {/* Score bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/40">
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">GTO Trainer</span>
          <span className="text-gray-600 text-xs">|</span>
          <span className="text-gray-500 text-xs">{hand.rangeScenario}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {sessionStats.streak >= 3 && (
            <div className="flex items-center gap-1 text-orange-400 font-bold">
              <span>{sessionStats.streak}</span>
              <span className="text-orange-500 text-[10px]">STREAK</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Score:</span>
            <span className="text-emerald-400 font-bold">{sessionStats.correct}</span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">{sessionStats.total}</span>
          </div>
          <div className={`font-bold ${sessionStats.totalBBWon >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {sessionStats.totalBBWon >= 0 ? "+" : ""}{sessionStats.totalBBWon.toFixed(1)}bb
          </div>
        </div>
      </div>

      {/* Table area */}
      <div className="flex-1 flex items-center justify-center px-4 py-2 relative">
        <PokerTable
          players={hand.players}
          communityCards={hand.visibleBoard}
          heroCards={hand.heroCards}
          potSize={hand.potSize}
          street={hand.street}
          streetLabel={streetLabel}
        />

        {/* Result overlay */}
        {hand.handComplete && (
          <ResultScreen hand={hand} onNext={nextHand} actionFeedbacks={actionFeedbacks} />
        )}
      </div>

      {/* Board texture + hand info (postflop) */}
      {hand.visibleBoard.length > 0 && !hand.handComplete && (
        <div className="px-4 pb-1">
          <BoardTexturePanel boardTexture={boardTexture} draws={draws} handEval={handEval} />
        </div>
      )}

      {/* Feedback Banner */}
      {showFeedback && !hand.handComplete && (
        <FeedbackBanner feedback={showFeedback} onDismiss={() => setShowFeedback(null)} />
      )}

      {/* Hand info */}
      <div className="text-center pb-1">
        <span className="text-gray-500 text-xs">
          Your hand:{" "}
          <CardInline card={hand.heroCards[0]} />{" "}
          <CardInline card={hand.heroCards[1]} />
          {"  "}
          <span className="text-gray-600">(</span>
          <span className="text-white font-bold">{hand.handKey}</span>
          <span className="text-gray-600">)</span>
          {"  "}
          <span className="text-gray-600">at</span>{" "}
          <span className="text-emerald-400 font-bold">{hand.heroPosition}</span>
          {hand.raiserPosition && (
            <>
              {"  "}
              <span className="text-gray-600">vs</span>{" "}
              <span className="text-red-400 font-bold">{hand.raiserPosition} open</span>
            </>
          )}
          {"  "}
          <span className="text-gray-600">|</span>{" "}
          <span className={`font-semibold ${hand.heroIsIP ? "text-cyan-400" : "text-orange-400"}`}>
            {hand.heroIsIP ? "In Position" : "Out of Position"}
          </span>
        </span>
      </div>

      {/* GTO advice line */}
      {gtoAdvice && !hand.handComplete && (
        <div className="text-center pb-1 px-4">
          <span className="text-gray-600 text-[10px] italic">
            {gtoAdvice}
          </span>
        </div>
      )}

      {/* Keyboard hints */}
      <div className="text-center pb-1">
        <span className="text-gray-700 text-[9px]">
          Keys: [F]old [C]heck/Call [B]et [R]aise [A]ll-in | [N]ext hand
        </span>
      </div>

      {/* Action buttons */}
      <div className="bg-gray-900/60 border-t border-gray-800 px-4 py-3">
        {hand.waitingForHero && !hand.handComplete ? (
          <div className="space-y-2 max-w-2xl mx-auto">
            {/* Main actions row */}
            <div className="flex items-center justify-center gap-2">
              {/* FOLD */}
              {canFold && (
                <button
                  onClick={() => heroAct("fold")}
                  className="flex-1 max-w-[120px] py-2.5 rounded-xl font-bold text-sm uppercase tracking-wide transition-all active:scale-95
                    bg-gray-700/80 hover:bg-gray-600 text-white border border-gray-600/40"
                >
                  Fold
                </button>
              )}

              {/* CHECK */}
              {canCheck && (
                <button
                  onClick={() => heroAct("check")}
                  className="flex-1 max-w-[120px] py-2.5 rounded-xl font-bold text-sm uppercase tracking-wide transition-all active:scale-95
                    bg-gray-600/80 hover:bg-gray-500 text-white border border-gray-500/40"
                >
                  Check
                </button>
              )}

              {/* CALL */}
              {canCall && (
                <button
                  onClick={() => heroAct("call")}
                  className="flex-1 max-w-[120px] py-2.5 rounded-xl font-bold text-sm uppercase tracking-wide transition-all active:scale-95
                    bg-emerald-700/80 hover:bg-emerald-600 text-white border border-emerald-600/40"
                >
                  Call {hand.facingBetAmount > 0 ? (hand.facingBetAmount - hand.heroBetThisStreet).toFixed(1) : ""}
                </button>
              )}

              {/* RAISE (preflop) */}
              {canRaise && hand.street === "preflop" && (
                <button
                  onClick={() => heroAct("raise", hand.spotType === "3-Bet" ? 7.5 : 2.5)}
                  className="flex-1 max-w-[120px] py-2.5 rounded-xl font-bold text-sm uppercase tracking-wide transition-all active:scale-95
                    bg-red-700/80 hover:bg-red-600 text-white border border-red-600/40"
                >
                  {hand.spotType === "3-Bet" ? "3-Bet" : "Raise 2.5"}
                </button>
              )}

              {/* ALL-IN */}
              <button
                onClick={() => heroAct("allin")}
                className="flex-1 max-w-[120px] py-2.5 rounded-xl font-bold text-sm uppercase tracking-wide transition-all active:scale-95
                  bg-red-900/80 hover:bg-red-800 text-white border border-red-800/40"
              >
                All-In
              </button>
            </div>

            {/* Bet sizing row (postflop, not facing bet) */}
            {canBet && (
              <div className="flex items-center justify-center gap-2">
                <span className="text-gray-500 text-xs font-semibold mr-1">BET:</span>
                {potBetSizes.map((size) => {
                  const betAmt = Math.round(hand.potSize * size.mult * 10) / 10;
                  return (
                    <button
                      key={size.label}
                      onClick={() => heroAct("bet", betAmt)}
                      className="px-3 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95
                        bg-orange-700/70 hover:bg-orange-600 text-white border border-orange-600/40"
                    >
                      {size.label} ({betAmt.toFixed(1)})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Raise sizing row (postflop, facing bet) */}
            {hand.facingBet && hand.street !== "preflop" && (
              <div className="flex items-center justify-center gap-2">
                <span className="text-gray-500 text-xs font-semibold mr-1">RAISE:</span>
                {[
                  { label: "2.5x", mult: 2.5 },
                  { label: "3x", mult: 3.0 },
                ].map((size) => {
                  const raiseAmt = Math.round(hand.facingBetAmount * size.mult * 10) / 10;
                  return (
                    <button
                      key={size.label}
                      onClick={() => heroAct("raise", raiseAmt)}
                      className="px-3 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95
                        bg-red-700/70 hover:bg-red-600 text-white border border-red-600/40"
                    >
                      {size.label} ({raiseAmt.toFixed(1)})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : !hand.handComplete ? (
          <div className="text-center">
            <span className="text-gray-500 text-sm animate-pulse">Opponent is thinking...</span>
          </div>
        ) : (
          <div className="text-center">
            <button
              onClick={nextHand}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all active:scale-95"
            >
              Deal Next Hand
            </button>
          </div>
        )}
      </div>

      {/* Session Stats Panel */}
      <SessionStatsPanel
        stats={sessionStats}
        isOpen={statsOpen}
        onToggle={() => setStatsOpen(!statsOpen)}
        onReset={resetSession}
      />
    </div>
  );
}
