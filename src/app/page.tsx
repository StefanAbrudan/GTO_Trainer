"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadProgress, getAccuracy, UserProgress } from "@/lib/progress";
import { CHAPTERS } from "@/data/gto-concepts";
import { QUIZ_QUESTIONS } from "@/data/quiz-questions";

export default function Home() {
  const [progress, setProgress] = useState<UserProgress | null>(null);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const accuracy = progress ? getAccuracy(progress) : 0;
  const totalAnswered = progress?.totalQuestions || 0;
  const streak = progress?.streakDays || 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900/40 via-gray-900 to-blue-900/40 border border-gray-800 p-8">
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-white mb-2">
            GTO <span className="text-emerald-400">Trainer</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mb-6">
            Master Game Theory Optimal poker strategy with interactive quizzes, range analysis,
            equity calculations, and spaced repetition learning.
          </p>
          <div className="flex gap-3">
            <Link
              href="/trainer"
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 animate-pulse-glow"
            >
              Start Training
            </Link>
            <Link
              href="/quiz"
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-all border border-gray-700"
            >
              Quick Quiz
            </Link>
          </div>
        </div>
        {/* Decorative cards */}
        <div className="absolute right-8 top-6 opacity-20 text-8xl font-black text-white select-none">
          A♠
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-3xl font-black text-white">{totalAnswered}</div>
          <div className="text-sm text-gray-400">Questions Answered</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-3xl font-black text-emerald-400">{accuracy}%</div>
          <div className="text-sm text-gray-400">Accuracy</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-3xl font-black text-orange-400">{streak}</div>
          <div className="text-sm text-gray-400">Day Streak</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-3xl font-black text-blue-400">{QUIZ_QUESTIONS.length}</div>
          <div className="text-sm text-gray-400">Total Questions</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/trainer"
          className="group bg-gray-900 border border-gray-800 hover:border-emerald-700 rounded-xl p-5 transition-all"
        >
          <div className="text-2xl mb-2">🎯</div>
          <h3 className="text-white font-bold group-hover:text-emerald-400 transition-colors">
            GTO Trainer
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Spaced repetition training with questions tailored to your skill level and weak spots.
          </p>
        </Link>
        <Link
          href="/ranges"
          className="group bg-gray-900 border border-gray-800 hover:border-blue-700 rounded-xl p-5 transition-all"
        >
          <div className="text-2xl mb-2">🃏</div>
          <h3 className="text-white font-bold group-hover:text-blue-400 transition-colors">
            Range Viewer
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Explore GTO opening ranges, 3-bet ranges, and more for every position.
          </p>
        </Link>
        <Link
          href="/calculator"
          className="group bg-gray-900 border border-gray-800 hover:border-purple-700 rounded-xl p-5 transition-all"
        >
          <div className="text-2xl mb-2">🧮</div>
          <h3 className="text-white font-bold group-hover:text-purple-400 transition-colors">
            EV Calculator
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Calculate pot odds, MDF, EV, geometric sizing, and bluff frequencies.
          </p>
        </Link>
      </div>

      {/* Chapters */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Learning Chapters</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {CHAPTERS.map((ch) => {
            const cp = progress?.chapterProgress[ch.id];
            const answered = cp?.total || 0;

            return (
              <Link
                key={ch.id}
                href={`/lessons?chapter=${ch.id}`}
                className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 transition-all group"
              >
                <div className="text-2xl mb-2">{ch.icon}</div>
                <h3 className="text-white font-bold text-sm group-hover:text-emerald-400 transition-colors">
                  {ch.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ch.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-600">{ch.lessonCount} lessons</span>
                  {answered > 0 && (
                    <span className="text-xs text-emerald-500">{answered} answered</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
