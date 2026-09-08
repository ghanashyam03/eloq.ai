export interface TTSPlayerOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
}

/**
 * Client-side Text-To-Speech audio player supporting Web Speech synthesis,
 * audio buffer playback, and immediate interruption cancellation.
 */
export class TTSPlayer {
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private activeAudioElement: HTMLAudioElement | null = null;
  private isPlayingState = false;

  public isPlaying(): boolean {
    return this.isPlayingState;
  }

  /**
   * Immediately interrupts and cancels any currently playing TTS audio.
   * Called when the user starts speaking or clicks cancel.
   */
  public cancelPlayback(): void {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (this.activeAudioElement) {
      this.activeAudioElement.pause();
      this.activeAudioElement.currentTime = 0;
      this.activeAudioElement = null;
    }

    this.activeUtterance = null;
    this.isPlayingState = false;
  }

  /**
   * Speaks raw text using browser-native SpeechSynthesis.
   */
  public speakText(text: string, options?: TTSPlayerOptions): Promise<void> {
    this.cancelPlayback(); // Interrupt any existing audio

    if (typeof window === "undefined" || !window.speechSynthesis) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options?.rate ?? 1.0;
      utterance.pitch = options?.pitch ?? 1.0;

      if (options?.voice) {
        const voices = window.speechSynthesis.getVoices();
        const matched = voices.find((v) => v.name.includes(options.voice!) || v.lang.includes(options.voice!));
        if (matched) utterance.voice = matched;
      }

      this.activeUtterance = utterance;
      this.isPlayingState = true;

      utterance.onend = () => {
        this.isPlayingState = false;
        this.activeUtterance = null;
        resolve();
      };

      utterance.onerror = () => {
        this.isPlayingState = false;
        this.activeUtterance = null;
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Plays a synthesized binary audio payload (e.g. MP3/WAV buffer from server TTS).
   */
  public playAudioBuffer(audioBlob: Blob): Promise<void> {
    this.cancelPlayback(); // Interrupt any existing audio

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      this.activeAudioElement = audio;
      this.isPlayingState = true;

      audio.onended = () => {
        this.isPlayingState = false;
        this.activeAudioElement = null;
        URL.revokeObjectURL(url);
        resolve();
      };

      audio.onerror = (err) => {
        this.isPlayingState = false;
        this.activeAudioElement = null;
        URL.revokeObjectURL(url);
        reject(err);
      };

      audio.play().catch(reject);
    });
  }
}

export const ttsPlayer = new TTSPlayer();
