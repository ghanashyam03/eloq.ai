"use client";

import React, { useState } from "react";
import { SpeakingInterface } from "@/components/speech/SpeakingInterface";

type SimulationMode =
  | "free_practice"
  | "interview"
  | "debate"
  | "professional_scenario"
  | "academic_discussion"
  | "roleplay";

interface ModeOption {
  id: SimulationMode;
  label: string;
  description: string;
  icon: string;
}

const MODES: ModeOption[] = [
  {
    id: "free_practice",
    label: "Free Conversation",
    description: "Open natural voice dialogue with adaptive feedback",
    icon: "💬",
  },
  {
    id: "interview",
    label: "Job Interview",
    description: "High-stakes behavioral and technical interview simulation",
    icon: "💼",
  },
  {
    id: "debate",
    label: "Debate & Persuasion",
    description: "Strict opposing stance practice to sharpen argument fluency",
    icon: "⚖️",
  },
  {
    id: "professional_scenario",
    label: "Executive Briefing",
    description: "Professional workplace scenarios & stakeholder discussions",
    icon: "👔",
  },
  {
    id: "academic_discussion",
    label: "Academic Seminar",
    description: "In-depth conceptual discussions and analytical expression",
    icon: "🎓",
  },
  {
    id: "roleplay",
    label: "Immersive Roleplay",
    description: "Real-world situational conversation practice",
    icon: "🎭",
  },
];

export default function Home() {
  const [selectedMode, setSelectedMode] = useState<SimulationMode>("free_practice");
  const [conversationId, setConversationId] = useState("conv-eloq-1");

  const currentModeInfo = MODES.find((m) => m.id === selectedMode) ?? MODES[0]!;

  const handleModeChange = (modeId: SimulationMode) => {
    setSelectedMode(modeId);
    setConversationId(`conv-eloq-${modeId}-${Date.now()}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white flex flex-col">
      {/* Minimalist Top Bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-blue-500/10">
            E
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Eloq AI
            </h1>
            <p className="text-[11px] text-slate-500">Real-Time Voice Fluency Engine</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AI Voice Ready
          </span>
        </div>
      </header>

      {/* Main Minimalist Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-6 flex flex-col space-y-6">
        {/* Mode Switcher Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {MODES.map((mode) => {
            const isActive = selectedMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => handleModeChange(mode.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex items-center gap-2 border ${
                  isActive
                    ? "bg-slate-900 border-blue-500/50 text-white shadow-md shadow-blue-500/5"
                    : "bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <span>{mode.icon}</span>
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Mode Banner */}
        <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl px-5 py-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block mb-0.5">
              Active Simulation Scenario
            </span>
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <span>{currentModeInfo.icon}</span>
              <span>{currentModeInfo.label}</span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-md text-right hidden sm:block">
            {currentModeInfo.description}
          </p>
        </div>

        {/* Central Voice Practice Interface */}
        <div className="flex-1 bg-slate-900/60 border border-slate-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm">
          <SpeakingInterface
            userId="demo-user"
            conversationId={conversationId}
            mode={selectedMode}
          />
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-900 py-3 px-6 text-center text-xs text-slate-600">
        Eloq AI &bull; Intelligent Real-Time Voice Fluency &amp; Linguistic Mastery Engine
      </footer>
    </div>
  );
}
