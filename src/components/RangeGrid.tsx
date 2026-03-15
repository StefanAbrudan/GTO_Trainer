"use client";

import { useState } from "react";
import { RANKS, getHandKey, isSuited, isPair, getFrequencyColor, RangeData, PREFLOP_RANGES, THREEBET_RANGES } from "@/data/preflop-ranges";

export function RangeGrid({ range, compact = false }: { range: RangeData; compact?: boolean }) {
  const cellSize = compact ? "w-7 h-7 text-[9px]" : "w-10 h-10 text-[11px]";

  return (
    <div className="inline-block">
      <div className="grid grid-cols-13 gap-[1px]">
        {RANKS.map((_, row) =>
          RANKS.map((_, col) => {
            const hand = getHandKey(row, col);
            const freq = range.grid[hand] ?? 0;
            const bgColor = getFrequencyColor(freq);
            const suited = isSuited(row, col);
            const pair = isPair(row, col);

            return (
              <div
                key={`${row}-${col}`}
                className={`${cellSize} ${bgColor} flex items-center justify-center rounded-sm font-mono font-medium transition-all hover:brightness-125 cursor-default ${
                  pair ? "ring-1 ring-white/20" : ""
                }`}
                title={`${hand}: ${freq}%`}
              >
                <span className={`${freq > 0 ? "text-white" : "text-gray-600"} ${suited ? "" : ""}`}>
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

export function RangeSelector() {
  const [selectedRange, setSelectedRange] = useState(0);
  const [rangeType, setRangeType] = useState<"open" | "3bet">("open");

  const ranges = rangeType === "open" ? PREFLOP_RANGES : THREEBET_RANGES;
  const currentRange = ranges[Math.min(selectedRange, ranges.length - 1)];

  // Count combos
  const totalCombos = Object.entries(currentRange.grid).reduce((acc, [hand, freq]) => {
    if (freq === 0) return acc;
    let combos = 0;
    if (hand.length === 2) combos = 6; // pair
    else if (hand.endsWith("s")) combos = 4; // suited
    else combos = 12; // offsuit
    return acc + combos * (freq / 100);
  }, 0);

  const pctOfHands = ((totalCombos / 1326) * 100).toFixed(1);

  return (
    <div className="space-y-4">
      {/* Range type selector */}
      <div className="flex gap-2">
        <button
          onClick={() => { setRangeType("open"); setSelectedRange(0); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            rangeType === "open"
              ? "bg-emerald-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          Open Raise (RFI)
        </button>
        <button
          onClick={() => { setRangeType("3bet"); setSelectedRange(0); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            rangeType === "3bet"
              ? "bg-emerald-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          3-Bet
        </button>
      </div>

      {/* Position selector */}
      <div className="flex gap-2 flex-wrap">
        {ranges.map((r, i) => (
          <button
            key={r.position}
            onClick={() => setSelectedRange(i)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
              selectedRange === i
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            {r.position}
          </button>
        ))}
      </div>

      {/* Range info */}
      <div className="flex items-center gap-4 text-sm">
        <div className="bg-gray-800/50 rounded-lg px-3 py-2">
          <span className="text-gray-400">Position: </span>
          <span className="text-white font-bold">{currentRange.position}</span>
        </div>
        <div className="bg-gray-800/50 rounded-lg px-3 py-2">
          <span className="text-gray-400">Action: </span>
          <span className="text-emerald-400 font-bold">{currentRange.action}</span>
        </div>
        <div className="bg-gray-800/50 rounded-lg px-3 py-2">
          <span className="text-gray-400">Hands: </span>
          <span className="text-yellow-400 font-bold">{pctOfHands}%</span>
          <span className="text-gray-500 ml-1">({Math.round(totalCombos)} combos)</span>
        </div>
      </div>

      {/* Grid */}
      <RangeGrid range={currentRange} />

      {/* Legend */}
      <div className="flex gap-3 items-center text-xs text-gray-400">
        <span>Frequency:</span>
        {[0, 20, 40, 60, 80, 100].map((f) => (
          <div key={f} className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded ${getFrequencyColor(f)}`} />
            <span>{f}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
