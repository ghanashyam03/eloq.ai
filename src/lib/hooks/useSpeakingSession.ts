import { useState, useEffect, useRef, useCallback } from "react";
import { SpeakingState, SpeakingTurn } from "@/domain/speech/speaking-session.schema";
import { AudioRecorder, AudioRecorderError } from "../audio/audio-recorder";
import { ttsPlayer } from "../audio/tts-player";

export interface UseSpeakingSessionOptions {
  userId: string;
  conversationId: string;
  autoPlayTTS?: boolean;
  enableBargeIn?: boolean;
}

export function useSpeakingSession(options: UseSpeakingSessionOptions) {
  const [state, setState] = useState<SpeakingState>("IDLE");
  const [turns, setTurns] = useState<SpeakingTurn[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<string>("");
  const [recordingDurationSecs, setRecordingDurationSecs] = useState<number>(0);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeTurnIdRef = useRef<string | null>(null);
  const speechRecognitionRef = useRef<unknown>(null);
  const liveTranscriptRef = useRef<string>("");
  const isRecordingActiveRef = useRef<boolean>(false);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (speechRecognitionRef.current) {
        try {
          (speechRecognitionRef.current as { stop: () => void }).stop();
        } catch {}
      }
    };
  }, []);

  /**
   * Initializes AudioRecorder instance.
   */
  const getRecorder = useCallback(() => {
    if (!recorderRef.current) {
      recorderRef.current = new AudioRecorder();
    }
    return recorderRef.current;
  }, []);

  /**
   * Interruption / Barge-in: Cancels active TTS playback instantly.
   */
  const interruptAI = useCallback(() => {
    ttsPlayer.cancelPlayback();
    setState("READY");
  }, []);

  /**
   * Begins microphone recording and Web Speech API recognition.
   */
  const startRecording = useCallback(async () => {
    if (state === "SPEAKING") {
      interruptAI();
    }

    try {
      setState("REQUESTING_MIC_PERMISSION");
      const recorder = getRecorder();
      liveTranscriptRef.current = "";
      setCurrentTranscript("");
      isRecordingActiveRef.current = true;

      // 1. Acquire mic stream & start MediaRecorder FIRST so mic permissions are active
      await recorder.start();

      // 2. Start Web Speech API recognition AFTER mic permission is active
      if (typeof window !== "undefined") {
        const SpeechRecognition =
          (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

        if (SpeechRecognition) {
          try {
            const recognition = new (SpeechRecognition as new () => {
              continuous: boolean;
              interimResults: boolean;
              lang: string;
              onresult: (e: { resultIndex: number; results: Array<{ [key: number]: { transcript: string } }> }) => void;
              onend?: () => void;
              onerror?: (e: { error?: string }) => void;
              start: () => void;
            })();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = "en-US";
            recognition.onresult = (event) => {
              let text = "";
              for (let i = 0; i < event.results.length; i++) {
                const item = event.results[i]?.[0];
                if (item?.transcript) {
                  text += (text ? " " : "") + item.transcript.trim();
                }
              }
              if (text.trim()) {
                liveTranscriptRef.current = text.trim();
                setCurrentTranscript(text.trim());
              }
            };
            recognition.onend = () => {
              if (isRecordingActiveRef.current) {
                try {
                  recognition.start();
                } catch {}
              }
            };
            recognition.onerror = (errEvent: { error?: string }) => {
              console.warn("[WebSpeech] Recognition error:", errEvent.error);
            };
            recognition.start();
            speechRecognitionRef.current = recognition;
          } catch {
            // Fallback gracefully
          }
        }
      }

      setState("RECORDING");
      setRecordingDurationSecs(0);

      timerRef.current = setInterval(() => {
        setRecordingDurationSecs(recorder.getDurationSeconds());
      }, 200);
    } catch (err) {
      const recorderErr = err as AudioRecorderError;
      setState("ERROR");
      setErrorMessage(recorderErr.message ?? "Microphone access failed");
    }
  }, [state, getRecorder, interruptAI]);

  /**
   * Stops recording and processes the user turn via API.
   */
  const stopRecording = useCallback(async () => {
    isRecordingActiveRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (speechRecognitionRef.current) {
      try {
        (speechRecognitionRef.current as { stop: () => void }).stop();
      } catch {}
    }

    const recorder = getRecorder();
    if (recorder.getStatus() !== "recording") return;

    try {
      setState("TRANSCRIBING");
      // Allow Web Speech API's asynchronous final onresult buffer to flush (250ms)
      await new Promise((res) => setTimeout(res, 250));

      const result = await recorder.stop();

      setState("THINKING");
      const formData = new FormData();
      formData.append("userId", options.userId);
      formData.append("conversationId", options.conversationId);
      formData.append("audio", result.blob, "recording.webm");

      const capturedText = liveTranscriptRef.current.trim();
      if (!capturedText && process.env.NODE_ENV !== "test") {
        setState("ERROR");
        setErrorMessage(
          "No speech audio was detected from your microphone. Please check your mic volume and speak clearly, or type your message in the box below."
        );
        return;
      }
      if (capturedText) {
        formData.append("text", capturedText);
      }

      const response = await fetch("/api/speaking/turn", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error ?? "Speaking turn processing failed");
      }

      const turnResult = await response.json();
      const turn = turnResult.turn;
      activeTurnIdRef.current = turn.id;
      setTurns((prev) => [...prev, turn]);
      setCurrentTranscript(turn.userText);

      setState("READY");
    } catch (err) {
      const error = err as Error;
      if (error.name !== "AbortError") {
        setState("ERROR");
        setErrorMessage(error.message);
      }
    }
  }, [getRecorder, options.userId, options.conversationId]);

  /**
   * Text interaction fallback for accessibility.
   */
  const submitTextTurn = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      try {
        setState("THINKING");
        const response = await fetch("/api/speaking/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: options.userId,
            conversationId: options.conversationId,
            text,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error ?? "Speaking turn processing failed");
        }

        const turnResult = await response.json();
        const turn = turnResult.turn;
        activeTurnIdRef.current = turn.id;
        setTurns((prev) => [...prev, turn]);
        setCurrentTranscript(text);

        setState("READY");
      } catch (err) {
        const error = err as Error;
        if (error.name !== "AbortError") {
          setState("ERROR");
          setErrorMessage(error.message);
        }
      }
    },
    [options.userId, options.conversationId]
  );

  /**
   * Cancels active recording/playback.
   */
  const cancelTurn = useCallback(() => {
    isRecordingActiveRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const recorder = getRecorder();
    recorder.cancel();
    ttsPlayer.cancelPlayback();
    setState("READY");
    setErrorMessage(null);
  }, [getRecorder]);

  /**
   * Retries audio playback for a turn where TTS previously failed.
   */
  const retryTTS = useCallback(async (turnId: string) => {
    const targetTurn = turns.find((t) => t.id === turnId);
    if (targetTurn) {
      await ttsPlayer.speakText(targetTurn.assistantText);
    }
  }, [turns]);

  return {
    state,
    turns,
    errorMessage,
    currentTranscript,
    recordingDurationSecs,
    isRecording: state === "RECORDING",
    isThinking: state === "THINKING" || state === "TRANSCRIBING",
    isSpeaking: state === "SPEAKING",
    startRecording,
    stopRecording,
    interruptAI,
    submitTextTurn,
    cancelTurn,
    retryTTS,
  };
}
