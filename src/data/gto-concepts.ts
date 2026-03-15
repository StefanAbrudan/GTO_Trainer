// Core GTO concepts and lesson data derived from "Daily Dose of GTO" book structure
// 334 poker lessons organized by chapter

export type Chapter =
  | "fundamentals"
  | "quizzes"
  | "spots"
  | "streets"
  | "advanced"
  | "equity"
  | "stack-depth"
  | "tactics"
  | "offense"
  | "defense"
  | "formats"
  | "all-stars";

export interface Concept {
  id: string;
  chapter: Chapter;
  title: string;
  summary: string;
  keyPoints: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface QuizQuestion {
  id: string;
  chapter: Chapter;
  conceptId: string;
  scenario: string;
  board?: string[];
  heroPosition?: string;
  villainPosition?: string;
  potSize?: number;
  stackSize?: number;
  street: "preflop" | "flop" | "turn" | "river";
  options: { label: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface HandRange {
  position: string;
  action: string;
  scenario: string;
  hands: Record<string, number>; // hand -> frequency (0-100)
}

export const CHAPTERS: { id: Chapter; title: string; description: string; icon: string; lessonCount: number }[] = [
  { id: "fundamentals", title: "Fundamentals", description: "Building blocks of GTO strategy: preflop basics, tilt management, position, and core terminology.", icon: "🏗️", lessonCount: 30 },
  { id: "quizzes", title: "Quizzes", description: "Test your understanding with interactive quiz scenarios covering all skill levels.", icon: "❓", lessonCount: 30 },
  { id: "spots", title: "Spots", description: "Common and tricky poker situations: 3-bet pots, single raised pots, multiway, and more.", icon: "🎯", lessonCount: 30 },
  { id: "streets", title: "Streets", description: "Street-by-street strategy: flop c-betting, turn barreling, and river decisions.", icon: "🛣️", lessonCount: 30 },
  { id: "advanced", title: "Advanced Concepts", description: "Bankroll management, variance, game selection, and mental game.", icon: "🧠", lessonCount: 30 },
  { id: "equity", title: "Equity", description: "Equity distributions, equity realization, range vs range equity, and pot odds.", icon: "📊", lessonCount: 30 },
  { id: "stack-depth", title: "Stack Depth", description: "How stack-to-pot ratio changes strategy: deep stack, short stack, and middling stacks.", icon: "📏", lessonCount: 30 },
  { id: "tactics", title: "Tactics", description: "Specific tactical plays: check-raising, donk betting, probing, and overbetting.", icon: "⚔️", lessonCount: 34 },
  { id: "offense", title: "Offense", description: "Aggressive strategies: betting for value, bluffing frequencies, and bet sizing.", icon: "🗡️", lessonCount: 30 },
  { id: "defense", title: "Defense", description: "Defensive strategies: calling ranges, MDF, and facing aggression.", icon: "🛡️", lessonCount: 30 },
  { id: "formats", title: "Formats", description: "Format-specific strategy: MTTs, cash games, heads-up, spins, and bounty tournaments.", icon: "🎰", lessonCount: 30 },
  { id: "all-stars", title: "All Stars", description: "The most challenging and important lessons combining multiple concepts.", icon: "⭐", lessonCount: 30 },
];

export const CONCEPTS: Concept[] = [
  // === FUNDAMENTALS ===
  { id: "f1", chapter: "fundamentals", title: "Poker Glossary & Terminology", summary: "Understanding core poker terms: MDF, EV, SPR, equity realization, Nash Equilibrium, and more.", keyPoints: ["GTO Wizard provides a comprehensive glossary", "Terms like MDF, dEV, SPR are essential building blocks", "Understanding terminology accelerates learning"], difficulty: 1 },
  { id: "f2", chapter: "fundamentals", title: "Low-Hanging Fruit: Preflop Mastery", summary: "Mastering preflop is the highest-ROI study activity. Every hand starts preflop.", keyPoints: ["Preflop is the easiest street to master", "Solid preflop play sets up better postflop decisions", "Focus on opening ranges by position"], difficulty: 1 },
  { id: "f3", chapter: "fundamentals", title: "Tilt Management", summary: "Recognize tilt triggers and implement mitigation strategies.", keyPoints: ["Types: run-bad tilt, entitlement tilt, revenge tilt, winner's tilt", "Take breaks and inject logical thinking", "Set stop-loss limits and session time limits"], difficulty: 1 },
  { id: "f4", chapter: "fundamentals", title: "Position Fundamentals", summary: "Position is one of the biggest edges in poker. IP has massive advantages.", keyPoints: ["In position (IP) realizes more equity than out of position (OOP)", "Act last = more information = better decisions", "Position determines opening range width"], difficulty: 1 },
  { id: "f5", chapter: "fundamentals", title: "Pot Odds & Equity", summary: "Understand the relationship between pot odds and hand equity to make correct decisions.", keyPoints: ["Pot odds = amount to call / total pot after call", "Call when equity > pot odds", "Implied odds extend basic pot odds calculations"], difficulty: 1 },
  { id: "f6", chapter: "fundamentals", title: "Opening Ranges by Position", summary: "Each position has a mathematically optimal opening range that balances risk and reward.", keyPoints: ["UTG opens tightest (~15%), BTN opens widest (~45%)", "Ranges widen as position improves", "Premium hands open from all positions"], difficulty: 2 },
  { id: "f7", chapter: "fundamentals", title: "3-Betting Fundamentals", summary: "When and how to 3-bet for value and as bluffs.", keyPoints: ["3-bet for value with premium hands", "3-bet bluffs should have blockers and playability", "3-bet size varies by position (IP vs OOP)"], difficulty: 2 },
  { id: "f8", chapter: "fundamentals", title: "C-Betting Basics", summary: "Continuation betting strategy on the flop after being the preflop aggressor.", keyPoints: ["C-bet frequency varies by board texture", "High cards favor the preflop raiser", "Low, connected boards reduce c-bet frequency"], difficulty: 2 },
  { id: "f9", chapter: "fundamentals", title: "Bet Sizing Fundamentals", summary: "Different bet sizes accomplish different strategic goals.", keyPoints: ["Small bets (25-33%) target wide ranges", "Medium bets (50-75%) are standard value/bluff mix", "Large bets and overbets polarize your range"], difficulty: 2 },
  { id: "f10", chapter: "fundamentals", title: "Range Advantage vs Nut Advantage", summary: "Understanding who has the stronger overall range vs who has more nutted hands.", keyPoints: ["Range advantage: higher average equity across all hands", "Nut advantage: more very strong hands (top of range)", "These determine optimal bet sizing and frequency"], difficulty: 3 },

  // === SPOTS ===
  { id: "s1", chapter: "spots", title: "Single Raised Pots (SRP)", summary: "The most common pot type. Strategies for the preflop raiser and caller.", keyPoints: ["Raiser has range advantage on most boards", "Caller defends based on board texture", "Position determines c-bet approach"], difficulty: 2 },
  { id: "s2", chapter: "spots", title: "3-Bet Pots", summary: "Strategy changes significantly in 3-bet pots due to SPR and range dynamics.", keyPoints: ["SPR is lower, favoring overpairs and top pair", "Ranges are narrower = fewer bluffs needed", "Board coverage matters more"], difficulty: 3 },
  { id: "s3", chapter: "spots", title: "4-Bet Pots", summary: "Playing in 4-bet pots with very narrow, strong ranges.", keyPoints: ["Ranges are extremely narrow (QQ+, AKs typically)", "Often commit with any pair on the flop", "Bluffing frequency drops significantly"], difficulty: 4 },
  { id: "s4", chapter: "spots", title: "Multiway Pots", summary: "Adjustments needed when 3+ players see the flop.", keyPoints: ["Tighten up significantly in multiway pots", "Bluffing is much less effective", "Need stronger hands to continue"], difficulty: 3 },
  { id: "s5", chapter: "spots", title: "Blind vs Blind", summary: "Special dynamics when only SB and BB are in the pot.", keyPoints: ["SB opens very wide", "BB defends very wide", "Post-flop play is aggressive from both sides"], difficulty: 2 },

  // === STREETS ===
  { id: "st1", chapter: "streets", title: "Flop C-Bet Strategy", summary: "How board texture determines c-bet frequency and sizing.", keyPoints: ["Dry boards: high frequency, small sizing", "Wet boards: lower frequency, larger sizing", "Check back hands that benefit from protection"], difficulty: 2 },
  { id: "st2", chapter: "streets", title: "Turn Barreling", summary: "When to continue betting on the turn and when to check.", keyPoints: ["Barrel turns that improve your range", "Check turns that improve villain's range", "Double barrel bluffs need equity or blockers"], difficulty: 3 },
  { id: "st3", chapter: "streets", title: "River Decision Making", summary: "River play is pure math: value bet, bluff, or check.", keyPoints: ["No more cards to come: equity is 0% or 100%", "Value bet threshold: >50% equity when called", "Bluff-to-value ratio depends on bet size"], difficulty: 3 },
  { id: "st4", chapter: "streets", title: "Turn and River Sizing", summary: "Geometric and non-geometric bet sizing across streets.", keyPoints: ["Geometric sizing: consistent pot fractions across streets", "Larger turn bets set up river shoves", "Blocker bets when out of position with medium hands"], difficulty: 4 },

  // === ADVANCED CONCEPTS ===
  { id: "a1", chapter: "advanced", title: "Equity Realization", summary: "Not all equity is created equal. Position, playability, and skill affect how much equity you actually realize.", keyPoints: ["IP realizes more equity than OOP", "Suited hands realize more than offsuit", "Connected hands realize more through implied odds"], difficulty: 3 },
  { id: "a2", chapter: "advanced", title: "Minimum Defense Frequency (MDF)", summary: "How often you must continue facing a bet to prevent villain from profiting with any bluff.", keyPoints: ["MDF = 1 - [bet / (pot + bet)]", "MDF vs 50% pot = 66.7% continue", "MDF vs 100% pot = 50% continue", "MDF vs 150% pot = 40% continue"], difficulty: 3 },
  { id: "a3", chapter: "advanced", title: "Polarization vs Linear Ranges", summary: "Understanding when ranges should be polarized (nuts or air) vs linear (best hands down).", keyPoints: ["Polarized: big bets with strong hands and bluffs", "Linear: betting a merged range of good-to-great hands", "Board texture and SPR determine which approach"], difficulty: 4 },
  { id: "a4", chapter: "advanced", title: "Blockers and Card Removal", summary: "How the cards you hold affect opponent's possible holdings.", keyPoints: ["Holding an Ace blocks opponent's AA, AK, etc.", "Nut blockers are key bluffing candidates", "Blocking villain's folding range is bad for bluffs"], difficulty: 4 },
  { id: "a5", chapter: "advanced", title: "EV Calculations", summary: "Expected value math for poker decisions.", keyPoints: ["EV = (win% × win amount) - (lose% × lose amount)", "Positive EV decisions are profitable long-term", "Compare EV of different actions (bet/check/fold)"], difficulty: 3 },
  { id: "a6", chapter: "advanced", title: "Variance and Bankroll Management", summary: "Managing your bankroll to survive variance while maximizing growth.", keyPoints: ["20BI bankroll is minimum for aggressive players", "Conservative: 50-100 buy-ins", "Variance increases with aggressive style"], difficulty: 2 },

  // === EQUITY ===
  { id: "e1", chapter: "equity", title: "Equity Distributions", summary: "How equity is distributed across ranges and what it means for strategy.", keyPoints: ["Equity distribution graphs show range composition", "Condensed vs polarized distributions", "Distribution shape determines optimal strategy"], difficulty: 4 },
  { id: "e2", chapter: "equity", title: "Range vs Range Equity", summary: "Analyzing how entire ranges perform against each other.", keyPoints: ["Overall range equity determines aggressor", "Board changes can flip equity advantage", "Equity shifts guide strategy adjustments"], difficulty: 3 },
  { id: "e3", chapter: "equity", title: "Fold Equity", summary: "The value gained when opponents fold to your bet.", keyPoints: ["Fold equity = probability opponent folds × pot size", "Semi-bluffs combine fold equity with hand equity", "Fold equity increases with larger bet sizes"], difficulty: 3 },

  // === STACK DEPTH ===
  { id: "sd1", chapter: "stack-depth", title: "SPR (Stack-to-Pot Ratio)", summary: "How the ratio of remaining stacks to pot size affects postflop strategy.", keyPoints: ["Low SPR (<4): commit with top pair+", "Medium SPR (4-10): standard play", "High SPR (>10): implied odds matter more"], difficulty: 3 },
  { id: "sd2", chapter: "stack-depth", title: "Short Stack Strategy", summary: "Optimal play with 15bb or less.", keyPoints: ["Push/fold ranges become dominant", "Position less important with very short stacks", "ICM pressure amplifies short stack decisions in MTTs"], difficulty: 3 },
  { id: "sd3", chapter: "stack-depth", title: "Deep Stack Adjustments", summary: "How 150bb+ stacks change preflop and postflop play.", keyPoints: ["Speculative hands increase in value", "Implied odds become crucial", "More multi-street planning required"], difficulty: 4 },

  // === TACTICS ===
  { id: "t1", chapter: "tactics", title: "Check-Raising", summary: "When and how to check-raise for value and as a bluff.", keyPoints: ["Check-raise on boards that favor defender's range", "Include draws and strong hands", "Frequency depends on board texture and position"], difficulty: 3 },
  { id: "t2", chapter: "tactics", title: "Donk Betting", summary: "Leading into the preflop aggressor — when it's correct.", keyPoints: ["Donk on boards that shift equity to caller", "Low, connected boards are prime donk spots", "Donk bet sizing is usually small (25-33%)"], difficulty: 4 },
  { id: "t3", chapter: "tactics", title: "Overbetting", summary: "Betting more than the pot for maximum pressure.", keyPoints: ["Overbet when you have nut advantage", "Typically on turn and river", "Villain must fold 60%+ vs 150% pot overbet"], difficulty: 4 },
  { id: "t4", chapter: "tactics", title: "Probe Betting", summary: "Betting when the previous street checked through.", keyPoints: ["Probe when aggressor shows weakness by checking back", "Target hands that gave up equity on previous street", "Usually medium sizing (50-75% pot)"], difficulty: 3 },
  { id: "t5", chapter: "tactics", title: "Block Betting", summary: "Making a small bet OOP to control pot size and prevent larger bets.", keyPoints: ["Block bet with medium-strength hands OOP", "Prevents opponent from overbetting", "Typically 20-33% of pot"], difficulty: 3 },
  { id: "t6", chapter: "tactics", title: "Floating", summary: "Calling a bet with the intention of taking the pot away later.", keyPoints: ["Float with position and backdoor equity", "Plan to bet or raise on later streets", "Works best against frequent c-bettors"], difficulty: 3 },

  // === OFFENSE ===
  { id: "o1", chapter: "offense", title: "Value Betting Thin", summary: "Extracting value from marginal hands that are ahead of calling range.", keyPoints: ["Value bet when >50% equity vs calling range", "Thin value is a major skill differentiator", "Consider what worse hands can call"], difficulty: 4 },
  { id: "o2", chapter: "offense", title: "Bluffing Frequencies", summary: "How often to bluff based on bet sizing and game theory.", keyPoints: ["Bluff:value ratio matches pot odds", "50% pot = 1 bluff per 3 value bets", "100% pot = 1 bluff per 2 value bets"], difficulty: 3 },
  { id: "o3", chapter: "offense", title: "Triple Barreling", summary: "Betting all three streets for maximum pressure.", keyPoints: ["Need a coherent story across all streets", "Choose bluffs that block calling hands", "Consider if river improves your bluffing range"], difficulty: 4 },

  // === DEFENSE ===
  { id: "d1", chapter: "defense", title: "Facing C-Bets", summary: "How to defend against continuation bets optimally.", keyPoints: ["Use MDF as a baseline for defense frequency", "Raise strong hands and some draws", "Fold bottom of range without equity"], difficulty: 2 },
  { id: "d2", chapter: "defense", title: "Facing Overbets", summary: "Adjusting to overbets: MDF decreases, need strong hands.", keyPoints: ["MDF vs overbet: fold more of your range", "Keep hands that block value range", "Don't overfold or opponent profits with any bluff"], difficulty: 4 },
  { id: "d3", chapter: "defense", title: "Check-Calling Strategy", summary: "When check-calling is preferred over check-raising.", keyPoints: ["Check-call with hands that don't benefit from protection", "Strong hands that want to keep bluffs in", "Medium pairs on dry boards"], difficulty: 3 },

  // === FORMATS ===
  { id: "fm1", chapter: "formats", title: "MTT Strategy Adjustments", summary: "How tournament play differs from cash games.", keyPoints: ["ICM pressure affects decision making", "Stack preservation matters near bubble", "Antes change preflop dynamics"], difficulty: 3 },
  { id: "fm2", chapter: "formats", title: "Cash Game Specifics", summary: "Deep stack cash game strategy nuances.", keyPoints: ["No ICM: pure chip EV decisions", "Can rebuy: less risk aversion", "Typically 100bb+ effective stacks"], difficulty: 2 },
  { id: "fm3", chapter: "formats", title: "Heads-Up Play", summary: "Strategy for heads-up poker with very wide ranges.", keyPoints: ["Open nearly every hand from BTN", "Defend very wide from BB", "Aggression is key with wider ranges"], difficulty: 4 },
  { id: "fm4", chapter: "formats", title: "Short-Handed (6-Max)", summary: "Adjustments for 6-max tables vs full ring.", keyPoints: ["Wider opening ranges than 9-max", "Blinds come around faster", "More aggressive dynamics"], difficulty: 2 },
];
