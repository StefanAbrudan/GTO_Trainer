"use client";

import { SUIT_SYMBOLS } from "@/lib/poker";

// ── Types ──────────────────────────────────────────────────────────
export interface Card {
  rank: string; // "A","K",..."2"
  suit: "s" | "h" | "d" | "c";
}

export interface PlayerSeat {
  position: string; // "UTG" | "HJ" | "CO" | "BTN" | "SB" | "BB"
  stack: number;
  isHero: boolean;
  isActive: boolean; // still in the hand
  isCurrent: boolean; // current actor
  lastAction?: string; // "Fold","Raise 2.5", etc.
  hasFolded?: boolean;
  currentBet?: number; // current bet amount this street
}

export interface PokerTableProps {
  players: PlayerSeat[];
  communityCards: Card[];
  heroCards: Card[];
  potSize: number;
  street: "preflop" | "flop" | "turn" | "river";
  heroBet?: number;
  villainBet?: number;
  villainPosition?: string;
  streetLabel?: string;
}

// ── Card colours (GTO Wizard style) ───────────────────────────────
const SUIT_BG: Record<string, string> = {
  s: "bg-gray-600", // spades – dark gray
  h: "bg-red-600", // hearts – red
  d: "bg-blue-500", // diamonds – blue
  c: "bg-green-600", // clubs – green
};

const SUIT_TEXT: Record<string, string> = {
  s: "text-gray-100",
  h: "text-white",
  d: "text-white",
  c: "text-white",
};

// ── Seat positions (percentages for the oval layout) ──────────────
const SEAT_COORDS: Record<string, { top: string; left: string }> = {
  UTG: { top: "8%", left: "30%" },
  HJ: { top: "8%", left: "70%" },
  CO: { top: "44%", left: "92%" },
  BTN: { top: "78%", left: "72%" },
  SB: { top: "78%", left: "28%" },
  BB: { top: "44%", left: "4%" },
};

// Bet chip positions (closer to center than seats)
const BET_COORDS: Record<string, { top: string; left: string }> = {
  UTG: { top: "22%", left: "32%" },
  HJ: { top: "22%", left: "68%" },
  CO: { top: "42%", left: "80%" },
  BTN: { top: "62%", left: "68%" },
  SB: { top: "62%", left: "32%" },
  BB: { top: "42%", left: "16%" },
};

// ── Sub-components ────────────────────────────────────────────────

function CardFace({ card, size = "md" }: { card: Card; size?: "sm" | "md" | "lg" }) {
  const dim =
    size === "lg"
      ? "w-14 h-20 text-lg"
      : size === "md"
      ? "w-11 h-16 text-base"
      : "w-8 h-11 text-xs";

  return (
    <div
      className={`${dim} ${SUIT_BG[card.suit]} ${SUIT_TEXT[card.suit]} rounded-lg flex flex-col items-center justify-center font-bold shadow-lg border border-white/10 select-none`}
    >
      <span className="leading-none">{card.rank}</span>
      <span className="leading-none -mt-0.5">{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
}

function CardBack({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim =
    size === "lg"
      ? "w-14 h-20"
      : size === "md"
      ? "w-11 h-16"
      : "w-8 h-11";

  return (
    <div
      className={`${dim} rounded-lg bg-gradient-to-br from-blue-900 to-blue-700 border border-blue-500/30 shadow-lg flex items-center justify-center`}
    >
      <div className="w-3/4 h-3/4 rounded-sm border border-blue-400/20 bg-blue-800/60" />
    </div>
  );
}

function BetChip({ amount, position }: { amount: number; position: string }) {
  const coords = BET_COORDS[position];
  if (!coords || amount <= 0) return null;

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 z-15"
      style={{ top: coords.top, left: coords.left }}
    >
      <div className="bg-yellow-600/90 border-2 border-yellow-400/60 rounded-full px-2 py-0.5 shadow-lg">
        <span className="text-white text-[10px] font-bold">{amount.toFixed(1)}</span>
      </div>
    </div>
  );
}

function SeatBubble({ player }: { player: PlayerSeat }) {
  const coords = SEAT_COORDS[player.position];
  if (!coords) return null;

  const folded = player.hasFolded;
  const active = player.isCurrent;

  return (
    <div
      className="absolute flex flex-col items-center gap-1 -translate-x-1/2 -translate-y-1/2 z-10"
      style={{ top: coords.top, left: coords.left }}
    >
      {/* Position circle */}
      <div
        className={`
          w-14 h-14 rounded-full flex flex-col items-center justify-center text-xs font-bold border-2 transition-all
          ${folded ? "opacity-40 border-gray-700 bg-gray-800/60" : ""}
          ${active && !folded ? "border-yellow-400 bg-gray-800 ring-2 ring-yellow-400/40 animate-pulse" : ""}
          ${!active && !folded ? "border-gray-600 bg-gray-800/80" : ""}
          ${player.isHero ? "border-emerald-500 bg-gray-800" : ""}
        `}
      >
        <span className={`${player.isHero ? "text-emerald-400" : "text-gray-300"} font-bold text-[11px]`}>
          {player.position}
        </span>
        <span className="text-gray-400 text-[10px]">{player.stack.toFixed(1)}</span>
      </div>

      {/* Last action chip */}
      {player.lastAction && (
        <div
          className={`text-[9px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap
            ${player.lastAction === "Fold" ? "bg-gray-700/60 text-gray-500" : ""}
            ${player.lastAction.startsWith("Raise") || player.lastAction.startsWith("All") ? "bg-red-900/60 text-red-300" : ""}
            ${player.lastAction === "Call" ? "bg-emerald-900/50 text-emerald-300" : ""}
            ${player.lastAction.startsWith("Bet") ? "bg-orange-900/50 text-orange-300" : ""}
            ${player.lastAction === "Check" ? "bg-gray-700/50 text-gray-400" : ""}
            ${!["Fold", "Call", "Check"].includes(player.lastAction) && !player.lastAction.startsWith("Raise") && !player.lastAction.startsWith("Bet") && !player.lastAction.startsWith("All") ? "bg-gray-700/50 text-gray-400" : ""}
          `}
        >
          {player.lastAction}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function PokerTable({
  players,
  communityCards,
  heroCards,
  potSize,
  street,
  streetLabel,
}: PokerTableProps) {
  // Determine how many cards to show based on street for the reveal effect
  const visibleCommunityCards = communityCards;

  return (
    <div className="relative w-full max-w-[720px] mx-auto" style={{ aspectRatio: "16/10" }}>
      {/* Oval table background */}
      <div className="absolute inset-4 rounded-[50%] bg-gradient-to-b from-[#1a3a2a] to-[#0f2b1c] border-[6px] border-[#2a1f0f] shadow-[inset_0_2px_30px_rgba(0,0,0,0.5),0_0_40px_rgba(0,0,0,0.6)]" />

      {/* Table felt overlay for texture */}
      <div className="absolute inset-4 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(30,80,55,0.3)_0%,transparent_70%)]" />

      {/* Table rail / rim highlight */}
      <div className="absolute inset-[14px] rounded-[50%] border border-[#3d5a3d]/30" />

      {/* Street indicator */}
      {streetLabel && (
        <div className="absolute top-[18%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <div className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
            street === "preflop" ? "bg-gray-800/80 border-gray-600/40 text-gray-300" :
            street === "flop" ? "bg-emerald-900/80 border-emerald-600/40 text-emerald-300" :
            street === "turn" ? "bg-blue-900/80 border-blue-600/40 text-blue-300" :
            "bg-purple-900/80 border-purple-600/40 text-purple-300"
          }`}>
            {streetLabel}
          </div>
        </div>
      )}

      {/* Pot */}
      {potSize > 0 && (
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-1.5 border border-gray-600/30">
            <span className="text-gray-400 text-xs font-semibold">POT </span>
            <span className="text-white text-sm font-bold">{potSize.toFixed(1)}</span>
          </div>
        </div>
      )}

      {/* Community cards */}
      <div className="absolute top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1.5 z-20">
        {visibleCommunityCards.length > 0
          ? visibleCommunityCards.map((c, i) => <CardFace key={i} card={c} size="md" />)
          : street === "preflop" && (
              <div className="flex gap-1.5">
                <CardBack size="md" />
                <CardBack size="md" />
                <CardBack size="md" />
              </div>
            )}
      </div>

      {/* Bet chips for each player */}
      {players.map((p) =>
        p.currentBet && p.currentBet > 0 ? (
          <BetChip key={`bet-${p.position}`} amount={p.currentBet} position={p.position} />
        ) : null
      )}

      {/* Player seats */}
      {players.map((p) => (
        <SeatBubble key={p.position} player={p} />
      ))}

      {/* Hero's hole cards (below table) */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-2 z-30">
        {heroCards.map((c, i) => (
          <CardFace key={i} card={c} size="lg" />
        ))}
      </div>
    </div>
  );
}

export { CardFace, CardBack };
