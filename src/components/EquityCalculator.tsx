"use client";

import { useState } from "react";
import { calculateMDF, calculatePotOdds, calculateEV, geometricBetSize } from "@/lib/poker";

export function EquityCalculator() {
  const [potSize, setPotSize] = useState(10);
  const [betSize, setBetSize] = useState(7);
  const [equity, setEquity] = useState(40);
  const [stack, setStack] = useState(100);
  const [streets, setStreets] = useState(2);

  const mdf = calculateMDF(betSize, potSize);
  const potOdds = calculatePotOdds(betSize, potSize);
  const evCall = calculateEV(equity / 100, potSize + betSize, 1 - equity / 100, betSize);
  const evFold = 0;
  const geoSize = geometricBetSize(potSize, stack, streets);
  const bluffBreakeven = betSize / (potSize + betSize + betSize);

  return (
    <div className="space-y-6">
      {/* Input Controls */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Pot Size (bb)</label>
          <input
            type="range"
            min={1}
            max={200}
            value={potSize}
            onChange={(e) => setPotSize(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="text-center text-white font-bold text-lg">{potSize}bb</div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">Bet Size (bb)</label>
          <input
            type="range"
            min={1}
            max={200}
            value={betSize}
            onChange={(e) => setBetSize(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="text-center text-white font-bold text-lg">{betSize}bb</div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">Your Equity (%)</label>
          <input
            type="range"
            min={0}
            max={100}
            value={equity}
            onChange={(e) => setEquity(Number(e.target.value))}
            className="w-full accent-yellow-500"
          />
          <div className="text-center text-white font-bold text-lg">{equity}%</div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">Effective Stack (bb)</label>
          <input
            type="range"
            min={5}
            max={300}
            value={stack}
            onChange={(e) => setStack(Number(e.target.value))}
            className="w-full accent-purple-500"
          />
          <div className="text-center text-white font-bold text-lg">{stack}bb</div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">Streets Remaining</label>
          <input
            type="range"
            min={1}
            max={3}
            value={streets}
            onChange={(e) => setStreets(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="text-center text-white font-bold text-lg">{streets}</div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <ResultCard
          title="Pot Odds"
          value={`${(potOdds * 100).toFixed(1)}%`}
          subtitle={`Need ${(potOdds * 100).toFixed(1)}% equity to call`}
          color="blue"
        />
        <ResultCard
          title="MDF"
          value={`${(mdf * 100).toFixed(1)}%`}
          subtitle={`Must defend ${(mdf * 100).toFixed(1)}% vs this bet`}
          color="emerald"
        />
        <ResultCard
          title="EV of Calling"
          value={`${evCall >= 0 ? "+" : ""}${evCall.toFixed(1)}bb`}
          subtitle={evCall > 0 ? "Profitable call!" : evCall === 0 ? "Break-even" : "Unprofitable call"}
          color={evCall >= 0 ? "green" : "red"}
        />
        <ResultCard
          title="EV of Folding"
          value={`${evFold}bb`}
          subtitle="Always 0 — your baseline"
          color="gray"
        />
        <ResultCard
          title="Bet as % of Pot"
          value={`${((betSize / potSize) * 100).toFixed(0)}%`}
          subtitle={`${betSize}bb into ${potSize}bb pot`}
          color="yellow"
        />
        <ResultCard
          title="Bluff Breakeven"
          value={`${(bluffBreakeven * 100).toFixed(1)}%`}
          subtitle={`Villain must fold ${(bluffBreakeven * 100).toFixed(1)}%+`}
          color="purple"
        />
      </div>

      {/* Geometric sizing */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <h3 className="text-white font-bold mb-2">Geometric Bet Sizing</h3>
        <p className="text-gray-400 text-sm mb-3">
          The bet size that gets all-in over {streets} street{streets > 1 ? "s" : ""} with {stack}bb stack and {potSize}bb pot:
        </p>
        <div className="text-2xl font-bold text-emerald-400">
          {geoSize.toFixed(1)}bb
          <span className="text-sm text-gray-400 ml-2">
            ({((geoSize / potSize) * 100).toFixed(0)}% of pot)
          </span>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          SPR = {(stack / potSize).toFixed(1)} | After bet, pot becomes {(potSize + geoSize * 2).toFixed(1)}bb
        </div>
      </div>

      {/* Quick reference */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <h3 className="text-white font-bold mb-3">Quick MDF Reference</h3>
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          {[
            { size: "33%", mdf: "75%" },
            { size: "50%", mdf: "67%" },
            { size: "67%", mdf: "60%" },
            { size: "75%", mdf: "57%" },
            { size: "100%", mdf: "50%" },
            { size: "125%", mdf: "44%" },
            { size: "150%", mdf: "40%" },
            { size: "200%", mdf: "33%" },
          ].map((item) => (
            <div key={item.size} className="bg-gray-900/50 rounded-lg p-2">
              <div className="text-gray-400 text-xs">Bet {item.size}</div>
              <div className="text-white font-bold">MDF {item.mdf}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-700 bg-blue-900/20",
    emerald: "border-emerald-700 bg-emerald-900/20",
    green: "border-green-700 bg-green-900/20",
    red: "border-red-700 bg-red-900/20",
    gray: "border-gray-700 bg-gray-900/20",
    yellow: "border-yellow-700 bg-yellow-900/20",
    purple: "border-purple-700 bg-purple-900/20",
    orange: "border-orange-700 bg-orange-900/20",
  };

  return (
    <div className={`rounded-xl border p-3 ${colorMap[color] || colorMap.gray}`}>
      <div className="text-xs text-gray-400 mb-1">{title}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
    </div>
  );
}
