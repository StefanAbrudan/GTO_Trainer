"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CHAPTERS, CONCEPTS, Chapter, Concept } from "@/data/gto-concepts";

function LessonsContent() {
  const searchParams = useSearchParams();
  const chapterParam = searchParams.get("chapter") as Chapter | null;
  const [selectedChapter, setSelectedChapter] = useState<Chapter | "all">(chapterParam || "all");
  const [expandedConcept, setExpandedConcept] = useState<string | null>(null);

  const filtered =
    selectedChapter === "all"
      ? CONCEPTS
      : CONCEPTS.filter((c) => c.chapter === selectedChapter);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white">GTO Lessons</h1>
        <p className="text-gray-400 text-sm mt-1">
          Study core GTO concepts organized by chapter from the Daily Dose of GTO book.
        </p>
      </div>

      {/* Chapter filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedChapter("all")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            selectedChapter === "all"
              ? "bg-emerald-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          All ({CONCEPTS.length})
        </button>
        {CHAPTERS.map((ch) => {
          const count = CONCEPTS.filter((c) => c.chapter === ch.id).length;
          return (
            <button
              key={ch.id}
              onClick={() => setSelectedChapter(ch.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedChapter === ch.id
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {ch.icon} {ch.title} ({count})
            </button>
          );
        })}
      </div>

      {/* Concepts list */}
      <div className="space-y-3">
        {filtered.map((concept) => (
          <ConceptCard
            key={concept.id}
            concept={concept}
            expanded={expandedConcept === concept.id}
            onToggle={() =>
              setExpandedConcept(expandedConcept === concept.id ? null : concept.id)
            }
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No concepts found for this filter.
        </div>
      )}
    </div>
  );
}

function ConceptCard({
  concept,
  expanded,
  onToggle,
}: {
  concept: Concept;
  expanded: boolean;
  onToggle: () => void;
}) {
  const chapter = CHAPTERS.find((ch) => ch.id === concept.chapter);
  const difficultyStars = "★".repeat(concept.difficulty) + "☆".repeat(5 - concept.difficulty);

  return (
    <div
      className={`bg-gray-900 border rounded-xl transition-all cursor-pointer ${
        expanded ? "border-emerald-700 shadow-lg shadow-emerald-900/20" : "border-gray-800 hover:border-gray-700"
      }`}
      onClick={onToggle}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                {chapter?.icon} {chapter?.title}
              </span>
              <span className="text-xs text-yellow-500">{difficultyStars}</span>
            </div>
            <h3 className="text-white font-bold">{concept.title}</h3>
            <p className="text-sm text-gray-400 mt-1">{concept.summary}</p>
          </div>
          <span className={`text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}>
            ▼
          </span>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-800 animate-fade-in">
            <h4 className="text-sm font-bold text-emerald-400 mb-2">Key Points</h4>
            <ul className="space-y-2">
              {concept.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-emerald-500 mt-0.5 flex-shrink-0">●</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LessonsPage() {
  return (
    <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
      <LessonsContent />
    </Suspense>
  );
}
