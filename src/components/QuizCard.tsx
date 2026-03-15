"use client";

import { useState, useEffect, useCallback } from "react";
import { QuizQuestion } from "@/data/gto-concepts";
import { BoardDisplay } from "./CardDisplay";

interface QuizCardProps {
  question: QuizQuestion;
  onAnswer: (correct: boolean, responseTime: number) => void;
  questionNumber: number;
  totalQuestions: number;
}

export function QuizCard({ question, onAnswer, questionNumber, totalQuestions }: QuizCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [startTime] = useState(Date.now());

  const handleSelect = useCallback(
    (label: string) => {
      if (revealed) return;
      setSelected(label);
      setRevealed(true);
      const responseTime = Date.now() - startTime;
      const correct = label === question.correctAnswer;
      // Delay calling onAnswer to let user see the result
      setTimeout(() => onAnswer(correct, responseTime), 2000);
    },
    [revealed, startTime, question.correctAnswer, onAnswer]
  );

  // Reset on new question
  useEffect(() => {
    setSelected(null);
    setRevealed(false);
  }, [question.id]);

  const streetColors: Record<string, string> = {
    preflop: "bg-purple-600/20 text-purple-400 border-purple-500/30",
    flop: "bg-blue-600/20 text-blue-400 border-blue-500/30",
    turn: "bg-yellow-600/20 text-yellow-400 border-yellow-500/30",
    river: "bg-red-600/20 text-red-400 border-red-500/30",
  };

  const difficultyStars = Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={i < question.difficulty ? "text-yellow-400" : "text-gray-700"}>
      ★
    </span>
  ));

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">
          Question {questionNumber} of {totalQuestions}
        </span>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full border ${streetColors[question.street]}`}>
            {question.street.toUpperCase()}
          </span>
          <div className="flex text-sm">{difficultyStars}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-gray-800 rounded-full mb-6">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
          style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
        />
      </div>

      {/* Scenario */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 mb-4">
        {/* Position info */}
        {(question.heroPosition || question.villainPosition) && (
          <div className="flex gap-3 mb-3">
            {question.heroPosition && (
              <span className="text-xs bg-blue-600/30 text-blue-300 px-2 py-1 rounded">
                Hero: {question.heroPosition}
              </span>
            )}
            {question.villainPosition && (
              <span className="text-xs bg-red-600/30 text-red-300 px-2 py-1 rounded">
                Villain: {question.villainPosition}
              </span>
            )}
            {question.potSize && (
              <span className="text-xs bg-yellow-600/30 text-yellow-300 px-2 py-1 rounded">
                Pot: {question.potSize}bb
              </span>
            )}
            {question.stackSize && (
              <span className="text-xs bg-green-600/30 text-green-300 px-2 py-1 rounded">
                Stack: {question.stackSize}bb
              </span>
            )}
          </div>
        )}

        {/* Board */}
        {question.board && (
          <div className="mb-4">
            <BoardDisplay board={question.board} />
          </div>
        )}

        {/* Question text */}
        <p className="text-white text-lg leading-relaxed">{question.scenario}</p>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {question.options.map((opt) => {
          let optClass = "bg-gray-800/50 border-gray-700 hover:border-gray-500 hover:bg-gray-800";
          if (revealed) {
            if (opt.label === question.correctAnswer) {
              optClass = "bg-emerald-900/50 border-emerald-500 ring-1 ring-emerald-500/50";
            } else if (opt.label === selected && opt.label !== question.correctAnswer) {
              optClass = "bg-red-900/50 border-red-500 ring-1 ring-red-500/50";
            } else {
              optClass = "bg-gray-900/50 border-gray-800 opacity-50";
            }
          } else if (selected === opt.label) {
            optClass = "bg-blue-900/50 border-blue-500";
          }

          return (
            <button
              key={opt.label}
              onClick={() => handleSelect(opt.label)}
              disabled={revealed}
              className={`w-full text-left p-4 rounded-xl border transition-all ${optClass}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                    revealed && opt.label === question.correctAnswer
                      ? "bg-emerald-500 text-white"
                      : revealed && opt.label === selected
                      ? "bg-red-500 text-white"
                      : "bg-gray-700 text-gray-300"
                  }`}
                >
                  {opt.label}
                </span>
                <span className="text-gray-200 pt-1">{opt.text}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {revealed && (
        <div
          className={`mt-4 p-4 rounded-xl border transition-all duration-500 ${
            selected === question.correctAnswer
              ? "bg-emerald-900/30 border-emerald-700"
              : "bg-red-900/30 border-red-700"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{selected === question.correctAnswer ? "✓" : "✗"}</span>
            <span
              className={`font-bold ${
                selected === question.correctAnswer ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {selected === question.correctAnswer ? "Correct!" : "Incorrect"}
            </span>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}
