"use client";

import { formatCard } from "@/lib/poker";

export function CardDisplay({ card, size = "md" }: { card: string; size?: "sm" | "md" | "lg" }) {
  const { rank, suitSymbol, colorClass } = formatCard(card);
  const sizeClasses = {
    sm: "w-8 h-11 text-xs",
    md: "w-12 h-16 text-sm",
    lg: "w-16 h-22 text-lg",
  };

  return (
    <div
      className={`${sizeClasses[size]} bg-white rounded-lg shadow-lg border border-gray-300 flex flex-col items-center justify-center font-bold relative overflow-hidden`}
    >
      <span className={`${colorClass} leading-none`}>{rank}</span>
      <span className={`${colorClass} leading-none text-[0.7em]`}>{suitSymbol}</span>
    </div>
  );
}

export function BoardDisplay({ board, size = "md" }: { board: string[]; size?: "sm" | "md" | "lg" }) {
  return (
    <div className="flex gap-1.5 justify-center">
      {board.map((card, i) => (
        <CardDisplay key={i} card={card} size={size} />
      ))}
    </div>
  );
}
