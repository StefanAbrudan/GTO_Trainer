"use client";

import { ProgressDashboard } from "@/components/ProgressDashboard";

export default function ProgressPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white">Your Progress</h1>
        <p className="text-gray-400 text-sm mt-1">
          Track your GTO learning journey. Spaced repetition helps you retain what you learn.
        </p>
      </div>

      <ProgressDashboard />
    </div>
  );
}
