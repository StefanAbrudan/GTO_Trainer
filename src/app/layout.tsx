import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GTO Trainer — Master Poker Strategy",
  description:
    "Interactive GTO poker training app with quizzes, range viewer, equity calculator, and spaced repetition learning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-white`}
      >
        <Sidebar />
        <main className="ml-64 min-h-screen">
          <div className="max-w-6xl mx-auto p-6 md:p-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
