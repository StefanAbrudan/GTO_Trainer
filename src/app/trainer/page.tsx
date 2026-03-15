"use client";

import { useState, useEffect, useCallback } from "react";
import { QuizCard } from "@/components/QuizCard";
import { QUIZ_QUESTIONS } from "@/data/quiz-questions";
import { loadProgress, saveProgress, updateCardProgress, getDueCards, UserProgress } from "@/lib/progress";

export default function TrainerPage() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  const [sessionComplete, setSessionComplete] = useState(false);

  const SESSION_SIZE = 10;

  useEffect(() => {
    const p = loadProgress();
    setProgress(p);
    const allIds = QUIZ_QUESTIONS.map((q) => q.id);
    const due = getDueCards(p, allIds);
    setQueue(due.slice(0, SESSION_SIZE));
  }, []);

  const currentQuestionId = queue[currentIndex];
  const currentQuestion = QUIZ_QUESTIONS.find((q) => q.id === currentQuestionId);

  const handleAnswer = useCallback(
    (correct: boolean, responseTime: number) => {
      if (!progress || !currentQuestion) return;

      const updated = updateCardProgress(
        progress,
        currentQuestion.id,
        correct,
        currentQuestion.chapter,
        responseTime
      );
      setProgress(updated);
      saveProgress(updated);

      setSessionStats((prev) => ({
        correct: prev.correct + (correct ? 1 : 0),
        total: prev.total + 1,
      }));

      setTimeout(() => {
        if (currentIndex < queue.length - 1) {
          setCurrentIndex((i) => i + 1);
        } else {
          setSessionComplete(true);
        }
      }, 500);
    },
    [progress, currentQuestion, currentIndex, queue.length]
  );

  const restartSession = () => {
    if (!progress) return;
    const allIds = QUIZ_QUESTIONS.map((q) => q.id);
    const due = getDueCards(progress, allIds);
    setQueue(due.slice(0, SESSION_SIZE));
    setCurrentIndex(0);
    setSessionStats({ correct: 0, total: 0 });
    setSessionComplete(false);
  };

  if (!progress) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (sessionComplete) {
    const accuracy = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0;
    return (
      <div className="max-w-lg mx-auto text-center animate-slide-up">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <div className="text-6xl mb-4">{accuracy >= 80 ? "🏆" : accuracy >= 60 ? "👍" : "📚"}</div>
          <h2 className="text-2xl font-black text-white mb-2">Session Complete!</h2>
          <div className="text-5xl font-black text-emerald-400 mb-2">{accuracy}%</div>
          <p className="text-gray-400 mb-1">
            {sessionStats.correct} correct out of {sessionStats.total}
          </p>
          <p className="text-sm text-gray-600 mb-6">
            {accuracy >= 80
              ? "Excellent work! You're crushing it."
              : accuracy >= 60
              ? "Good progress! Keep practicing weak spots."
              : "Keep studying — review the lessons for topics you missed."}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={restartSession}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all"
            >
              Train Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="max-w-lg mx-auto text-center">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <div className="text-4xl mb-4">✨</div>
          <h2 className="text-xl font-bold text-white mb-2">All caught up!</h2>
          <p className="text-gray-400">No questions due for review. Come back later for spaced repetition.</p>
          <button
            onClick={restartSession}
            className="mt-4 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all"
          >
            Practice Anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Session header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">GTO Trainer</h1>
          <p className="text-sm text-gray-500">Spaced repetition training session</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="bg-gray-800 rounded-lg px-3 py-2">
            <span className="text-emerald-400 font-bold">{sessionStats.correct}</span>
            <span className="text-gray-500"> / {sessionStats.total}</span>
          </div>
          <div className="bg-gray-800 rounded-lg px-3 py-2">
            <span className="text-gray-400">Session: </span>
            <span className="text-white font-bold">{currentIndex + 1}/{queue.length}</span>
          </div>
        </div>
      </div>

      <QuizCard
        key={currentQuestion.id}
        question={currentQuestion}
        onAnswer={handleAnswer}
        questionNumber={currentIndex + 1}
        totalQuestions={queue.length}
      />
    </div>
  );
}
