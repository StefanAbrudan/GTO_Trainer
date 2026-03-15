"use client";

import { RangeSelector } from "@/components/RangeGrid";

export default function RangesPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white">Range Viewer</h1>
        <p className="text-gray-400 text-sm mt-1">
          Explore GTO-optimal preflop ranges for each position. Hover over cells to see frequencies.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <RangeSelector />
      </div>

      {/* Range tips */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-white font-bold mb-2">Reading the Grid</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• <strong className="text-white">Diagonal</strong> = Pocket pairs (AA, KK, etc.)</li>
            <li>• <strong className="text-white">Above diagonal</strong> = Suited hands (AKs, QJs)</li>
            <li>• <strong className="text-white">Below diagonal</strong> = Offsuit hands (AKo, QJo)</li>
            <li>• <strong className="text-green-400">Green</strong> = High frequency open</li>
            <li>• <strong className="text-red-400">Red</strong> = Low frequency / mixed</li>
            <li>• <strong className="text-gray-600">Gray</strong> = Fold</li>
          </ul>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-white font-bold mb-2">Key Principles</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• Ranges widen as position improves (UTG → BTN)</li>
            <li>• Suited hands are much more playable than offsuit</li>
            <li>• Connected hands have better equity realization</li>
            <li>• 3-bet ranges use polarized construction (premiums + bluffs)</li>
            <li>• Mixed frequencies mean the hand is borderline</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
