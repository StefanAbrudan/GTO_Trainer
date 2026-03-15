"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/trainer", label: "GTO Trainer", icon: "🎯" },
  { href: "/quiz", label: "Quick Quiz", icon: "❓" },
  { href: "/ranges", label: "Range Viewer", icon: "🃏" },
  { href: "/lessons", label: "Lessons", icon: "📚" },
  { href: "/calculator", label: "EV Calculator", icon: "🧮" },
  { href: "/progress", label: "Progress", icon: "📈" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-screen fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="p-5 border-b border-gray-800">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-emerald-500/20">
            G
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">GTO Trainer</h1>
            <p className="text-gray-500 text-xs">Master Poker Strategy</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/30"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <div className="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 rounded-lg p-3 border border-emerald-800/30">
          <p className="text-xs text-gray-400">
            Based on <span className="text-emerald-400 font-medium">Daily Dose of GTO</span> — 334 lessons from GTO Wizard
          </p>
        </div>
      </div>
    </aside>
  );
}
