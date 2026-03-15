"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import PokerTable, { Card, PlayerSeat } from "@/components/PokerTable";
import {
  PREFLOP_RANGES,
  THREEBET_RANGES,
  RANKS,
  getHandKey,
  getFrequencyColor,
  isPair,
  isSuited,
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

// ── Settings ──────────────────────────────────────────────────────
interface TrainerSettings {
  positions: Record<Position, boolean>;
  stackDepth: StackDepth;
  blinds: string;
  spotTypes: Record<SpotType, boolean>;
}

const DEFAULT_SETTINGS: TrainerSettings = {
  positions: { UTG: true, HJ: true, CO: true, BTN: true, SB: true, BB: true },
  stackDepth: 100,
  blinds: "0.5/1",
  spotTypes: { RFI: true, "3-Bet": true, vs3Bet: false },
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
}

function emptySessionStats(): SessionStats {
  const perPos = {} as Record<Position, PositionStats>;
  for (const p of POSITIONS) perPos[p] = { correct: 0, total: 0 };
  return { correct: 0, total: 0, streak: 0, bestStreak: 0, perPosition: perPos, mistakes: [] };
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

// ── Scenario ─────────────────────────────────────────────────────
interface Scenario {
  heroPosition: Position;
  heroCards: [Card, Card];
  boardCards: Card[];
  players: PlayerSeat[];
  actionHistory: ActionEntry[];
  potSize: number;
  gtoAction: "Fold" | "Call" | "Raise" | "Allin";
  gtoFrequency: number;
  handKey: string;
  rangeScenario: string;
  street: "preflop" | "flop" | "turn" | "river";
  facingAction: string;
  spotType: SpotType;
  rangeGrid: Record<string, number>; // the full range for this spot
  raiserPosition?: string; // position of the original raiser (for 3-bet spots)
  callFrequency: number;
  foldFrequency: number;
  explanation: string;
}

interface ActionEntry {
  position: string;
  stack: number;
  action: string;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getEnabledPositions(settings: TrainerSettings): Position[] {
  return POSITIONS.filter((p) => settings.positions[p]);
}

function generateExplanation(handKey: string, position: string, gtoAction: string, freq: number, spotType: SpotType): string {
  const actionWord = gtoAction === "Raise" ? (spotType === "3-Bet" ? "3-bet" : "open-raise") : "fold";
  if (freq >= 95) {
    return `${handKey} is a mandatory ${actionWord} from ${position} (${gtoAction.toLowerCase()} 100%)`;
  } else if (freq >= 70) {
    return `${handKey} is a strong ${actionWord} from ${position} (${freq}% frequency)`;
  } else if (freq >= 40) {
    return `${handKey} is a mixed spot from ${position} — ${actionWord} ${freq}% of the time`;
  } else if (freq > 0) {
    return `${handKey} is mostly a fold from ${position} but can be ${spotType === "3-Bet" ? "3-bet" : "raised"} at low frequency (${freq}%)`;
  } else {
    return `${handKey} should always be folded from ${position}`;
  }
}

function generateScenario(settings: TrainerSettings): Scenario {
  const deck = shuffleDeck(buildDeck());
  let idx = 0;
  const deal = (): Card => deck[idx++];

  const enabledPositions = getEnabledPositions(settings);
  if (enabledPositions.length === 0) {
    // fallback
    enabledPositions.push("BTN");
  }

  const stack = settings.stackDepth;

  // Decide spot type based on enabled settings
  const enabledSpots: SpotType[] = [];
  if (settings.spotTypes.RFI) enabledSpots.push("RFI");
  if (settings.spotTypes["3-Bet"]) enabledSpots.push("3-Bet");
  if (enabledSpots.length === 0) enabledSpots.push("RFI");

  const spotType = pickRandom(enabledSpots);

  let heroPos: Position;
  let rangeData: RangeData | undefined;
  let actionHistory: ActionEntry[] = [];
  const stacks: Record<string, number> = {};
  POSITIONS.forEach((p) => (stacks[p] = stack));
  stacks["SB"] -= 0.5;
  stacks["BB"] -= 1;
  let pot = 1.5;
  let facingAction = "";
  let raiserPosition: string | undefined;

  if (spotType === "3-Bet") {
    // Pick a 3-bet scenario from available ranges
    const available3Bets = THREEBET_RANGES.filter((r) =>
      enabledPositions.includes(r.position as Position)
    );
    if (available3Bets.length > 0) {
      rangeData = pickRandom(available3Bets);
      heroPos = rangeData.position as Position;

      // Determine raiser from scenario text
      if (rangeData.scenario.includes("vs CO")) raiserPosition = "CO";
      else if (rangeData.scenario.includes("vs HJ")) raiserPosition = "HJ";
      else if (rangeData.scenario.includes("vs BTN")) raiserPosition = "BTN";
      else if (rangeData.scenario.includes("vs SB")) raiserPosition = "SB";

      // Build action history: everyone folds to raiser, raiser opens, then to hero
      const raiserIdx = raiserPosition ? POSITIONS.indexOf(raiserPosition as Position) : 0;
      const heroIdx = POSITIONS.indexOf(heroPos);

      for (let i = 0; i < raiserIdx; i++) {
        const pos = POSITIONS[i];
        actionHistory.push({ position: pos, stack: stacks[pos], action: "Fold" });
      }

      // Raiser opens to 2.5bb
      if (raiserPosition) {
        stacks[raiserPosition] -= 2.5;
        pot += 2.5;
        actionHistory.push({ position: raiserPosition, stack: stacks[raiserPosition], action: "Raise 2.5" });
      }

      // Players between raiser and hero fold
      for (let i = raiserIdx + 1; i < heroIdx; i++) {
        const pos = POSITIONS[i];
        if (pos !== heroPos) {
          actionHistory.push({ position: pos, stack: stacks[pos], action: "Fold" });
        }
      }

      facingAction = `${raiserPosition} opens, ${heroPos} to act`;
    } else {
      // Fallback to RFI
      heroPos = pickRandom(enabledPositions);
      rangeData = PREFLOP_RANGES.find((r) => r.position === heroPos);
      const heroIdx = POSITIONS.indexOf(heroPos);
      for (let i = 0; i < heroIdx; i++) {
        const pos = POSITIONS[i];
        actionHistory.push({ position: pos, stack: stacks[pos], action: "Fold" });
      }
      facingAction = `Folded to ${heroPos}`;
    }
  } else {
    // RFI spot
    // Filter positions that have RFI data (BB excluded)
    const rfiPositions = enabledPositions.filter((p) => PREFLOP_RANGES.some((r) => r.position === p));
    heroPos = rfiPositions.length > 0 ? pickRandom(rfiPositions) : pickRandom(enabledPositions);
    rangeData = PREFLOP_RANGES.find((r) => r.position === heroPos);

    const heroIdx = POSITIONS.indexOf(heroPos);
    for (let i = 0; i < heroIdx; i++) {
      const pos = POSITIONS[i];
      actionHistory.push({ position: pos, stack: stacks[pos], action: "Fold" });
    }
    facingAction = `Folded to ${heroPos}`;
  }

  // Deal hero cards
  const heroCards: [Card, Card] = [deal(), deal()];
  const handKey = cardsToHandKey(heroCards[0], heroCards[1]);
  const boardCards = [deal(), deal(), deal()];

  // Determine GTO action from range
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
    // No range data - use a generic tight range
    gtoFrequency = 0;
    gtoAction = "Fold";
    rangeScenario = `6-Max, ${stack}bb, ${heroPos}`;
    grid = {};
  }

  const callFrequency = spotType === "3-Bet" ? Math.max(0, Math.min(100, 100 - gtoFrequency - (100 - gtoFrequency) * 0.6)) : 0;
  const foldFrequency = 100 - gtoFrequency - callFrequency;

  const explanation = generateExplanation(handKey, heroPos, gtoAction, gtoFrequency, spotType);

  // Build player seats
  const heroIdx = POSITIONS.indexOf(heroPos);
  const players: PlayerSeat[] = POSITIONS.map((pos) => {
    const posIdx = POSITIONS.indexOf(pos);
    let folded = false;
    let lastAction: string | undefined = undefined;

    // Check action history
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
    };
  });

  return {
    heroPosition: heroPos,
    heroCards,
    boardCards,
    players,
    actionHistory,
    potSize: pot,
    gtoAction,
    gtoFrequency,
    handKey,
    rangeScenario,
    street: "preflop",
    facingAction,
    spotType,
    rangeGrid: grid,
    raiserPosition,
    callFrequency,
    foldFrequency,
    explanation,
  };
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

          <div className="flex gap-6">
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

// ── GTO Recommendation Panel ────────────────────────────────────────
function GTOPanel({
  scenario,
  correct,
  userAction,
  onNext,
}: {
  scenario: Scenario;
  correct: boolean;
  userAction: string;
  onNext: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in overflow-y-auto py-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 max-w-lg w-full mx-4 shadow-2xl">
        {/* Result header */}
        <div className="text-center mb-4">
          <div className={`text-4xl mb-2 ${correct ? "text-emerald-400" : "text-red-400"}`}>
            {correct ? "\u2713" : "\u2717"}
          </div>
          <h3 className={`text-lg font-black mb-1 ${correct ? "text-emerald-400" : "text-red-400"}`}>
            {correct ? "Correct!" : "Incorrect"}
          </h3>
          <p className="text-gray-400 text-xs">
            You chose <span className={`font-bold ${correct ? "text-emerald-300" : "text-red-300"}`}>{userAction}</span>
            {" | "}GTO: <span className="text-white font-bold">{scenario.gtoAction}</span> with{" "}
            <span className="text-white font-bold">{scenario.handKey}</span> from{" "}
            <span className="text-emerald-400 font-bold">{scenario.heroPosition}</span>
          </p>
        </div>

        {/* Explanation */}
        <div className={`rounded-lg p-3 mb-4 text-sm border ${
          correct
            ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-200"
            : "bg-red-950/40 border-red-800/40 text-red-200"
        }`}>
          {scenario.explanation}
        </div>

        {/* Frequency bars */}
        <div className="bg-gray-800/60 rounded-lg p-3 mb-4 space-y-2">
          <div className="text-xs text-gray-500 mb-1 font-semibold">{scenario.rangeScenario}</div>
          {/* Raise */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs w-12 text-right">Raise</span>
            <div className="flex-1 h-2.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full transition-all"
                style={{ width: `${scenario.gtoFrequency}%` }}
              />
            </div>
            <span className="text-white text-xs font-bold w-10">{scenario.gtoFrequency}%</span>
          </div>
          {/* Call (only in 3-bet spots) */}
          {scenario.spotType === "3-Bet" && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-xs w-12 text-right">Call</span>
              <div className="flex-1 h-2.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${scenario.callFrequency}%` }}
                />
              </div>
              <span className="text-white text-xs font-bold w-10">{Math.round(scenario.callFrequency)}%</span>
            </div>
          )}
          {/* Fold */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs w-12 text-right">Fold</span>
            <div className="flex-1 h-2.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-500 rounded-full transition-all"
                style={{ width: `${scenario.foldFrequency}%` }}
              />
            </div>
            <span className="text-white text-xs font-bold w-10">{Math.round(scenario.foldFrequency)}%</span>
          </div>
        </div>

        {/* Mini range grid */}
        <div className="mb-4">
          <div className="text-xs text-gray-500 font-semibold mb-2">
            Full Range ({scenario.heroPosition} {scenario.spotType === "3-Bet" ? "3-Bet" : "RFI"})
          </div>
          <div className="flex justify-center">
            <MiniRangeGrid
              grid={scenario.rangeGrid}
              highlightHand={scenario.handKey}
              correct={correct}
            />
          </div>
          {/* Legend */}
          <div className="flex gap-2 items-center justify-center mt-2 text-[9px] text-gray-500">
            {[0, 20, 50, 80, 100].map((f) => (
              <div key={f} className="flex items-center gap-0.5">
                <div className={`w-2.5 h-2.5 rounded-sm ${getFrequencyColor(f)}`} />
                <span>{f}%</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onNext}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all active:scale-95"
        >
          Next Hand
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

  // Top 5 most common mistakes
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
            <span className={`font-bold ${accuracy >= 70 ? "text-emerald-400" : accuracy >= 50 ? "text-yellow-400" : "text-red-400"}`}>
              {accuracy}%
            </span>
          )}
          {stats.streak > 0 && (
            <span className="text-orange-400 font-bold">{stats.streak} streak</span>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in">
          {/* Overview row */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-white">{stats.total}</div>
              <div className="text-[9px] text-gray-500 uppercase">Hands</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className={`text-lg font-bold ${accuracy >= 70 ? "text-emerald-400" : accuracy >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                {stats.total > 0 ? `${accuracy}%` : "--"}
              </div>
              <div className="text-[9px] text-gray-500 uppercase">Accuracy</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-orange-400">{stats.streak}</div>
              <div className="text-[9px] text-gray-500 uppercase">Streak</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-purple-400">{stats.bestStreak}</div>
              <div className="text-[9px] text-gray-500 uppercase">Best</div>
            </div>
          </div>

          {/* Per-position accuracy */}
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

          {/* Most common mistakes */}
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

          {/* Reset button */}
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
  const [scenario, setScenario] = useState<Scenario>(() => generateScenario(DEFAULT_SETTINGS));
  const [showResult, setShowResult] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [lastUserAction, setLastUserAction] = useState("");
  const [sessionStats, setSessionStats] = useState<SessionStats>(emptySessionStats);

  // Regenerate when settings change
  const handleSettingsChange = useCallback((newSettings: TrainerSettings) => {
    setSettings(newSettings);
    if (!showResult) {
      setScenario(generateScenario(newSettings));
    }
  }, [showResult]);

  const handleAction = useCallback(
    (action: "Fold" | "Call" | "Raise" | "Allin") => {
      if (showResult) return;

      let correct = false;
      if (scenario.gtoAction === "Raise") {
        correct = action === "Raise" || action === "Allin";
      } else {
        correct = action === "Fold";
      }

      setLastCorrect(correct);
      setLastUserAction(action);
      setSessionStats((prev) => {
        const newStats = { ...prev };
        newStats.total += 1;
        newStats.correct += correct ? 1 : 0;
        newStats.streak = correct ? prev.streak + 1 : 0;
        newStats.bestStreak = Math.max(newStats.bestStreak, newStats.streak);

        // Per-position
        const pos = scenario.heroPosition;
        newStats.perPosition = { ...prev.perPosition };
        newStats.perPosition[pos] = {
          correct: prev.perPosition[pos].correct + (correct ? 1 : 0),
          total: prev.perPosition[pos].total + 1,
        };

        // Track mistakes
        if (!correct) {
          newStats.mistakes = [
            ...prev.mistakes,
            {
              handKey: scenario.handKey,
              position: scenario.heroPosition,
              scenario: scenario.rangeScenario,
              yourAction: action,
              gtoAction: scenario.gtoAction,
            },
          ];
        }

        return newStats;
      });
      setShowResult(true);
    },
    [scenario, showResult]
  );

  const nextHand = useCallback(() => {
    setScenario(generateScenario(settings));
    setShowResult(false);
  }, [settings]);

  const resetSession = useCallback(() => {
    setSessionStats(emptySessionStats());
  }, []);

  const accuracy = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0;

  // Build the action history bar text
  const historySegments = useMemo(() => {
    const segs: { text: string; highlight?: boolean }[] = [];
    for (const a of scenario.actionHistory) {
      segs.push({
        text: `${a.position} ${a.stack.toFixed(a.stack % 1 === 0 ? 0 : 1)} ${a.action}`,
      });
    }
    segs.push({
      text: `${scenario.heroPosition} ${settings.stackDepth} Take action`,
      highlight: true,
    });
    return segs;
  }, [scenario, settings.stackDepth]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showResult) {
        if (e.key === "Enter" || e.key === " " || e.key === "n") {
          e.preventDefault();
          nextHand();
        }
        return;
      }
      if (e.key === "f" || e.key === "1") handleAction("Fold");
      else if (e.key === "c" || e.key === "2") handleAction("Call");
      else if (e.key === "r" || e.key === "3") handleAction("Raise");
      else if (e.key === "a" || e.key === "4") handleAction("Allin");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showResult, handleAction, nextHand]);

  // Button labels based on spot type
  const raiseLabel = scenario.spotType === "3-Bet" ? "3-Bet" : "Raise 2.5";
  const showCallButton = scenario.spotType === "3-Bet";

  return (
    <div className="relative min-h-screen bg-gray-950 flex flex-col select-none">
      {/* ── Settings Panel (collapsible) ──────────────── */}
      <SettingsPanel
        settings={settings}
        onChange={handleSettingsChange}
        isOpen={settingsOpen}
        onToggle={() => setSettingsOpen(!settingsOpen)}
      />

      {/* ── Top bar: action history ──────────────────────────── */}
      <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-2 flex items-center gap-1 overflow-x-auto text-xs font-mono whitespace-nowrap scrollbar-thin">
        <span className="text-gray-600 mr-2 text-[10px] font-sans font-semibold uppercase">
          {scenario.spotType === "3-Bet" ? "3-BET" : "RFI"}
        </span>
        {historySegments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-600 mx-1">|</span>}
            <span className={seg.highlight ? "text-yellow-400 font-bold" : "text-gray-400"}>
              {seg.text}
            </span>
          </span>
        ))}
      </div>

      {/* ── Score bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/40">
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">GTO Trainer</span>
          <span className="text-gray-600 text-xs">|</span>
          <span className="text-gray-500 text-xs">{scenario.rangeScenario}</span>
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
          {sessionStats.total > 0 && (
            <div className={`font-bold ${accuracy >= 70 ? "text-emerald-400" : accuracy >= 50 ? "text-yellow-400" : "text-red-400"}`}>
              {accuracy}%
            </div>
          )}
        </div>
      </div>

      {/* ── Table area ───────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4 py-2 relative">
        <PokerTable
          players={scenario.players}
          communityCards={scenario.street === "preflop" ? [] : scenario.boardCards.map((c) => c)}
          heroCards={scenario.heroCards}
          potSize={scenario.potSize}
          street={scenario.street}
        />

        {/* GTO Result overlay */}
        {showResult && (
          <GTOPanel
            scenario={scenario}
            correct={lastCorrect}
            userAction={lastUserAction}
            onNext={nextHand}
          />
        )}
      </div>

      {/* ── Hand info ────────────────────────────────────────── */}
      <div className="text-center pb-1">
        <span className="text-gray-500 text-xs">
          Your hand:{" "}
          <CardInline card={scenario.heroCards[0]} />{" "}
          <CardInline card={scenario.heroCards[1]} />
          {"  "}
          <span className="text-gray-600">(</span>
          <span className="text-white font-bold">{scenario.handKey}</span>
          <span className="text-gray-600">)</span>
          {"  "}
          <span className="text-gray-600">at</span>{" "}
          <span className="text-emerald-400 font-bold">{scenario.heroPosition}</span>
          {scenario.spotType === "3-Bet" && scenario.raiserPosition && (
            <>
              {"  "}
              <span className="text-gray-600">vs</span>{" "}
              <span className="text-red-400 font-bold">{scenario.raiserPosition} open</span>
            </>
          )}
        </span>
      </div>

      {/* ── Keyboard hint ────────────────────────────────────── */}
      <div className="text-center pb-1">
        <span className="text-gray-700 text-[9px]">
          Keys: [F]old [C]all [R]aise [A]ll-in | [Enter] next
        </span>
      </div>

      {/* ── Action buttons ───────────────────────────────────── */}
      <div className="bg-gray-900/60 border-t border-gray-800 px-4 py-3">
        <div className="flex items-center justify-center gap-3 max-w-xl mx-auto">
          {/* FOLD */}
          <button
            onClick={() => handleAction("Fold")}
            disabled={showResult}
            className="flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all active:scale-95
              bg-gray-700/80 hover:bg-gray-600 text-white border border-gray-600/40
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Fold
          </button>

          {/* CALL — shown in 3-bet pots */}
          {showCallButton && (
            <button
              onClick={() => handleAction("Call")}
              disabled={showResult}
              className="flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all active:scale-95
                bg-emerald-700/80 hover:bg-emerald-600 text-white border border-emerald-600/40
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Call
            </button>
          )}

          {/* RAISE / 3-BET */}
          <button
            onClick={() => handleAction("Raise")}
            disabled={showResult}
            className="flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all active:scale-95
              bg-red-700/80 hover:bg-red-600 text-white border border-red-600/40
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {raiseLabel}
          </button>

          {/* ALLIN */}
          <button
            onClick={() => handleAction("Allin")}
            disabled={showResult}
            className="flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all active:scale-95
              bg-red-900/80 hover:bg-red-800 text-white border border-red-800/40
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            All-In
          </button>
        </div>
      </div>

      {/* ── Session Stats Panel (collapsible, bottom) ─────── */}
      <SessionStatsPanel
        stats={sessionStats}
        isOpen={statsOpen}
        onToggle={() => setStatsOpen(!statsOpen)}
        onReset={resetSession}
      />
    </div>
  );
}
