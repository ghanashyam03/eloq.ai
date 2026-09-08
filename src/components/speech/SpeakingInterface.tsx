"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSpeakingSession } from "@/lib/hooks/useSpeakingSession";

export interface SpeakingInterfaceProps {
  userId: string;
  conversationId: string;
  mode?: string;
}

export const SpeakingInterface: React.FC<SpeakingInterfaceProps> = ({
  userId,
  conversationId,
  mode = "free_practice",
}) => {
  const {
    state,
    turns,
    errorMessage,
    recordingDurationSecs,
    isRecording,
    isThinking,
    isSpeaking,
    startRecording,
    stopRecording,
    interruptAI,
    submitTextTurn,
    cancelTurn,
    retryTTS,
  } = useSpeakingSession({ userId, conversationId });

  const [textInput, setTextInput] = useState("");
  const turnsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest turn
  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, state]);

  // Keyboard shortcut handlers (Space to record toggle, Escape to interrupt/cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      } else if (e.code === "Escape") {
        e.preventDefault();
        if (isSpeaking) {
          interruptAI();
        } else {
          cancelTurn();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecording, isSpeaking, startRecording, stopRecording, interruptAI, cancelTurn]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    submitTextTurn(textInput);
    setTextInput("");
  };

  return (
    <div
      className="flex flex-col h-[72vh] max-w-3xl mx-auto font-sans"
      role="region"
      aria-label="Eloq AI Voice Session"
    >
      {/* ARIA Live Region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Speaking session state: {state}. {errorMessage ? `Error: ${errorMessage}` : ""}
      </div>

      {/* State Status Bar */}
      <div className="flex items-center justify-between py-2 px-1 text-xs font-medium text-slate-400">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isRecording
                ? "bg-red-500 animate-ping"
                : isThinking
                ? "bg-amber-400 animate-pulse"
                : isSpeaking
                ? "bg-emerald-400 animate-bounce"
                : "bg-blue-500"
            }`}
          />
          <span className="capitalize tracking-wider text-slate-300">
            {isRecording
              ? `Listening (${recordingDurationSecs.toFixed(1)}s)`
              : isThinking
              ? "Eloq is thinking..."
              : isSpeaking
              ? "Eloq is speaking"
              : "Ready to listen"}
          </span>
        </div>

        <div className="flex items-center gap-3 text-slate-500">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60 text-[10px]">
              Space
            </kbd>{" "}
            Speak
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60 text-[10px]">
              Esc
            </kbd>{" "}
            Interrupt
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div
          className="my-2 p-3 bg-red-950/40 border border-red-800/50 text-red-300 text-xs rounded-xl flex items-center justify-between"
          role="alert"
        >
          <span>{errorMessage}</span>
          <button
            onClick={cancelTurn}
            className="text-xs font-medium text-red-400 hover:text-red-200 underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Conversation Thread */}
      <div className="flex-1 overflow-y-auto space-y-4 py-4 px-1 scrollbar-thin scrollbar-thumb-slate-800">
        {turns.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="h-16 w-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-2xl shadow-inner text-slate-400">
              🎙️
            </div>
            <h3 className="text-slate-200 font-semibold text-base mb-1">
              Start your speaking session
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Press the microphone or spacebar to speak. Eloq AI will listen, respond naturally, and refine your fluency.
            </p>
          </div>
        ) : (
          turns.map((turn) => (
            <div key={turn.id} className="space-y-3">
              {/* User Speech Bubble */}
              <div className="flex justify-end">
                <div className="max-w-lg bg-slate-800/90 text-slate-100 border border-slate-700/50 px-4 py-3 rounded-2xl rounded-tr-sm text-sm shadow-sm">
                  <p className="text-[11px] font-semibold text-slate-400 mb-1">You</p>
                  <p className="leading-relaxed">{turn.userText}</p>
                </div>
              </div>

              {/* AI Speech Bubble */}
              <div className="flex justify-start">
                <div className="max-w-xl bg-slate-900/90 border border-slate-800/80 px-4 py-3 rounded-2xl rounded-tl-sm text-sm shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                      Eloq AI
                    </span>
                    {turn.ttsFailed && (
                      <button
                        onClick={() => retryTTS(turn.id)}
                        className="text-[11px] text-amber-400 hover:underline"
                      >
                        Retry Audio
                      </button>
                    )}
                  </div>
                  <p className="text-slate-200 leading-relaxed">{turn.assistantText}</p>

                  {/* Clean Minimalist Grammar Feedback */}
                  {(() => {
                    const analysis = turn.analysis as any;
                    const allIssues = analysis
                      ? [
                          ...(analysis.highConfidenceIssues || []),
                          ...(analysis.mediumConfidenceIssues || []),
                          ...(analysis.issues || []),
                        ]
                      : [];
                    const isCorrect = !analysis || analysis.isCompletelyCorrect || allIssues.length === 0;

                    if (turn.analysisStatus !== "completed") return null;

                    return (
                      <div className="mt-3 pt-2 border-t border-slate-800/70 text-xs">
                        {!isCorrect && allIssues.length > 0 ? (
                          <div className="space-y-2">
                            {allIssues.map((issue: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 space-y-1"
                              >
                                <div className="flex items-center gap-2 text-[11px]">
                                  <span className="line-through text-red-400/90 font-mono">
                                    {issue.originalText}
                                  </span>
                                  <span className="text-slate-500">→</span>
                                  <span className="font-semibold text-emerald-400 font-mono">
                                    {issue.correctedText}
                                  </span>
                                </div>
                                {issue.explanation && (
                                  <p className="text-[11px] text-slate-400 leading-snug">
                                    {issue.explanation}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                            <span>✓</span> Natural phrasing & accurate grammar
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={turnsEndRef} />
      </div>

      {/* Main Interactive Controls */}
      <div className="pt-3 pb-1 border-t border-slate-800/80 space-y-3">
        {/* Record & Barge-In Buttons */}
        <div className="flex items-center justify-center gap-3">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isThinking}
              aria-label="Start recording speech"
              className="h-13 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm rounded-full shadow-lg shadow-blue-500/10 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2.5"
            >
              <span className="h-3 w-3 rounded-full bg-white animate-pulse" />
              <span>{isThinking ? "Thinking..." : "Tap to Speak"}</span>
            </button>
          ) : (
            <button
              onClick={stopRecording}
              aria-label="Stop recording speech"
              className="h-13 px-8 bg-red-600 hover:bg-red-500 text-white font-medium text-sm rounded-full shadow-lg shadow-red-500/20 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2.5"
            >
              <span className="h-3 w-3 rounded-full bg-white animate-ping" />
              <span>Finish Speaking ({recordingDurationSecs.toFixed(1)}s)</span>
            </button>
          )}

          {isSpeaking && (
            <button
              onClick={interruptAI}
              aria-label="Interrupt AI speech"
              className="h-11 px-5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold rounded-full transition-all"
            >
              Barge-In
            </button>
          )}
        </div>

        {/* Text Input Fallback */}
        <form onSubmit={handleTextSubmit} className="flex gap-2 pt-1">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type a message or response..."
            aria-label="Type message text"
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!textInput.trim() || isThinking}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-xs font-medium transition-colors disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
