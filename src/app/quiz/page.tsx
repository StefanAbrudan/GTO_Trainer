"use client";

import { useState, useCallback, useMemo } from "react";
import { QuizCard } from "@/components/QuizCard";
import { QUIZ_QUESTIONS } from "@/data/quiz-questions";
import { CHAPTERS, Chapter } from "@/data/gto-concepts";
import { loadProgress, saveProgress, updateCardProgress } from "@/lib/progress";

export default function QuizPage() {
  const [selectedChapter, setSelectedChapter] = useState<Chapter | "all">("all");
  const [difficulty, setDifficulty] = useState<number | "all">("all");
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState({ correct: 0, total: 0 });

  const filteredQuestions = useMemo(() => {
    let qs = [...QUIZ_QUESTIONS];
    if (selectedChapter !== "all") {
      qs = qs.filter((q) => q.chapter === selectedChapter);
    }
    if (difficulty !== "all") {
      qs = qs.filter((q) => q.difficulty === difficulty);
    }
    // Shuffle
    for (let i = qs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [qs[i], qs[j]] = [qs[j], qs[i]];
    }
    return qs;
  }, [selectedChapter, difficulty]);

  const currentQuestion = filteredQuestions[currentIndex];

  const handleAnswer = useCallback(
    (correct: boolean, responseTime: number) => {
      if (!currentQuestion) return;
      const progress = loadProgress();
      const updated = updateCardProgress(progress, currentQuestion.id, correct, currentQuestion.chapter, responseTime);
      saveProgress(updated);
      setStats((prev) => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));

      setTimeout(() => {
        if (currentIndex < filteredQuestions.length - 1) {
          setCurrentIndex((i) => i + 1);
        } else {
          setStarted(false);
          setCurrentIndex(0);
        }
      }, 500);
    },
    [currentQuestion, currentIndex, filteredQuestions.length]
  );

  if (!started) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-black text-white mb-2">Quick Quiz</h1>
        <p className="text-gray-400 mb-6">Choose a chapter and difficulty, then test your knowledge.</p>

        {/* Stats if any */}
        {stats.total > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
            <div className="text-sm text-gray-400">Last session</div>
            <div className="text-2xl font-bold text-white">
              {stats.correct}/{stats.total}{" "}
              <span className="text-emerald-400">
                ({Math.round((stats.correct / stats.total) * 100)}%)
              </span>
            </div>
          </div>
        )}

        {/* Chapter selector */}
        <div className="mb-4">
          <label className="text-sm text-gray-400 block mb-2">Chapter</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedChapter("all")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedChapter === "all"
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              All Chapters
            </button>
            {CHAPTERS.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelectedChapter(ch.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedChapter === ch.id
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {ch.icon} {ch.title}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="mb-6">
          <label className="text-sm text-gray-400 block mb-2">Difficulty</label>
          <div className="flex gap-2">
            <button
              onClick={() => setDifficulty("all")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                difficulty === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              All
            </button>
            {[1, 2, 3, 4, 5].map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  difficulty === d
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {"★".repeat(d)}{"☆".repeat(5 - d)}
              </button>
            ))}
          </div>
        </div>

        <div className="text-sm text-gray-500 mb-4">
          {filteredQuestions.length} questions available
        </div>

        <button
          onClick={() => {
            setStarted(true);
            setCurrentIndex(0);
            setStats({ correct: 0, total: 0 });
          }}
          disabled={filteredQuestions.length === 0}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl transition-all"
        >
          Start Quiz ({filteredQuestions.length} questions)
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-white">Quiz Complete!</h2>
        <button onClick={() => setStarted(false)} className="mt-4 px-4 py-2 bg-emerald-600 rounded-lg text-white">
          Back to Setup
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setStarted(false)}
          className="text-sm text-gray-500 hover:text-white transition-colors"
        >
          ← Back
        </button>
        <div className="text-sm text-gray-400">
          <span className="text-emerald-400 font-bold">{stats.correct}</span> / {stats.total} correct
        </div>
      </div>

      <QuizCard
        key={currentQuestion.id}
        question={currentQuestion}
        onAnswer={handleAnswer}
        questionNumber={currentIndex + 1}
        totalQuestions={filteredQuestions.length}
      />
    </div>
  );
}
