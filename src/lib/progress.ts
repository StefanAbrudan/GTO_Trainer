// Progress tracking with spaced repetition (SM-2 algorithm simplified)

export interface QuizResult {
  questionId: string;
  correct: boolean;
  timestamp: number;
  responseTime: number; // ms
}

export interface CardProgress {
  questionId: string;
  easeFactor: number; // 1.3 - 2.5
  interval: number; // days
  repetitions: number;
  nextReview: number; // timestamp
  lastResult: boolean;
  totalAttempts: number;
  correctAttempts: number;
}

export interface UserProgress {
  cards: Record<string, CardProgress>;
  history: QuizResult[];
  streakDays: number;
  lastStudyDate: string;
  totalQuestions: number;
  totalCorrect: number;
  chapterProgress: Record<string, { total: number; correct: number; mastered: number }>;
}

const STORAGE_KEY = "gto-trainer-progress";

export function loadProgress(): UserProgress {
  if (typeof window === "undefined") return getDefaultProgress();
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return getDefaultProgress();
  try {
    return JSON.parse(saved);
  } catch {
    return getDefaultProgress();
  }
}

export function saveProgress(progress: UserProgress): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function getDefaultProgress(): UserProgress {
  return {
    cards: {},
    history: [],
    streakDays: 0,
    lastStudyDate: "",
    totalQuestions: 0,
    totalCorrect: 0,
    chapterProgress: {},
  };
}

export function updateCardProgress(
  progress: UserProgress,
  questionId: string,
  correct: boolean,
  chapter: string,
  responseTime: number
): UserProgress {
  const now = Date.now();
  const today = new Date().toISOString().split("T")[0];

  // Update streak
  let streakDays = progress.streakDays;
  if (progress.lastStudyDate) {
    const lastDate = new Date(progress.lastStudyDate);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) streakDays += 1;
    else if (diffDays > 1) streakDays = 1;
  } else {
    streakDays = 1;
  }

  // SM-2 algorithm
  const card = progress.cards[questionId] || {
    questionId,
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    nextReview: now,
    lastResult: false,
    totalAttempts: 0,
    correctAttempts: 0,
  };

  card.totalAttempts += 1;
  card.lastResult = correct;

  if (correct) {
    card.correctAttempts += 1;
    card.repetitions += 1;
    if (card.repetitions === 1) card.interval = 1;
    else if (card.repetitions === 2) card.interval = 3;
    else card.interval = Math.round(card.interval * card.easeFactor);
    card.easeFactor = Math.max(1.3, card.easeFactor + 0.1);
  } else {
    card.repetitions = 0;
    card.interval = 1;
    card.easeFactor = Math.max(1.3, card.easeFactor - 0.3);
  }

  card.nextReview = now + card.interval * 24 * 60 * 60 * 1000;

  // Update chapter progress
  const chapterProg = progress.chapterProgress[chapter] || { total: 0, correct: 0, mastered: 0 };
  chapterProg.total += 1;
  if (correct) chapterProg.correct += 1;
  if (card.repetitions >= 3) chapterProg.mastered += 1; // consider "mastered" after 3 correct in a row

  return {
    ...progress,
    cards: { ...progress.cards, [questionId]: card },
    history: [...progress.history, { questionId, correct, timestamp: now, responseTime }],
    streakDays,
    lastStudyDate: today,
    totalQuestions: progress.totalQuestions + 1,
    totalCorrect: progress.totalCorrect + (correct ? 1 : 0),
    chapterProgress: { ...progress.chapterProgress, [chapter]: chapterProg },
  };
}

export function getDueCards(progress: UserProgress, allQuestionIds: string[]): string[] {
  const now = Date.now();
  const due: string[] = [];
  const unseen: string[] = [];

  for (const id of allQuestionIds) {
    const card = progress.cards[id];
    if (!card) {
      unseen.push(id);
    } else if (card.nextReview <= now) {
      due.push(id);
    }
  }

  // Return due cards first, then unseen
  return [...due, ...unseen];
}

export function getAccuracy(progress: UserProgress): number {
  if (progress.totalQuestions === 0) return 0;
  return Math.round((progress.totalCorrect / progress.totalQuestions) * 100);
}

export function getChapterAccuracy(progress: UserProgress, chapter: string): number {
  const cp = progress.chapterProgress[chapter];
  if (!cp || cp.total === 0) return 0;
  return Math.round((cp.correct / cp.total) * 100);
}
