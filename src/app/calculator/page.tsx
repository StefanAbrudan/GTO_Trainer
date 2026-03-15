"use client";

import { EquityCalculator } from "@/components/EquityCalculator";

export default function CalculatorPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white">EV Calculator</h1>
        <p className="text-gray-400 text-sm mt-1">
          Calculate pot odds, MDF, expected value, geometric sizing, and bluff breakeven frequencies.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <EquityCalculator />
      </div>
    </div>
  );
}
