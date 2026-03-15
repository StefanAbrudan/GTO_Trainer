"use client";

import { useEffect, useState } from "react";
import { loadProgress, getAccuracy, getChapterAccuracy, UserProgress } from "@/lib/progress";
import { CHAPTERS } from "@/data/gto-concepts";

export function ProgressDashboard() {
  const [progress, setProgress] = useState<UserProgress | null>(null);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  if (!progress) return null;

  const accuracy = getAccuracy(progress);

  return (
    <div className="space-y-6">
      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Questions Answered" value={progress.totalQuestions} icon="📝" />
        <StatCard label="Accuracy" value={`${accuracy}%`} icon="🎯" />
        <StatCard label="Day Streak" value={progress.streakDays} icon="🔥" />
        <StatCard
          label="Mastered"
          value={Object.values(progress.cards).filter((c) => c.repetitions >= 3).length}
          icon="⭐"
        />
      </div>

      {/* Chapter progress */}
      <div>
        <h3 className="text-white font-bold text-lg mb-3">Chapter Progress</h3>
        <div className="grid gap-2">
          {CHAPTERS.map((ch) => {
            const cp = progress.chapterProgress[ch.id];
            const acc = getChapterAccuracy(progress, ch.id);
            const total = cp?.total || 0;

            return (
              <div
                key={ch.id}
                className="flex items-center gap-4 bg-gray-800/50 border border-gray-700 rounded-lg p-3"
              >
                <span className="text-xl w-8">{ch.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white font-medium">{ch.title}</span>
                    <span className="text-xs text-gray-400">
                      {total > 0 ? `${acc}% accuracy (${total} answered)` : "Not started"}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-700 rounded-full">
                    <div
                      className={`h-full rounded-full transition-all ${
                        acc >= 80
                          ? "bg-emerald-500"
                          : acc >= 60
                          ? "bg-yellow-500"
                          : acc > 0
                          ? "bg-red-500"
                          : "bg-gray-700"
                      }`}
                      style={{ width: `${Math.max(acc, total > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent activity */}
      {progress.history.length > 0 && (
        <div>
          <h3 className="text-white font-bold text-lg mb-3">Recent Activity</h3>
          <div className="space-y-1">
            {progress.history
              .slice(-10)
              .reverse()
              .map((h, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm bg-gray-800/30 rounded-lg px-3 py-2"
                >
                  <span className={h.correct ? "text-emerald-400" : "text-red-400"}>
                    {h.correct ? "✓" : "✗"}
                  </span>
                  <span className="text-gray-400 font-mono text-xs">
                    {h.questionId}
                  </span>
                  <span className="text-gray-500 text-xs ml-auto">
                    {(h.responseTime / 1000).toFixed(1)}s
                  </span>
                  <span className="text-gray-600 text-xs">
                    {new Date(h.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
