import { SpeakingState, SpeakingStateSchema } from "@/domain/speech/speaking-session.schema";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

const VALID_TRANSITIONS: Record<SpeakingState, SpeakingState[]> = {
  IDLE: ["REQUESTING_MIC_PERMISSION", "READY", "TRANSCRIBING", "ERROR", "COMPLETED"],
  REQUESTING_MIC_PERMISSION: ["READY", "ERROR", "IDLE"],
  READY: ["RECORDING", "TRANSCRIBING", "PAUSED", "ERROR", "COMPLETED", "IDLE"],
  RECORDING: ["TRANSCRIBING", "INTERRUPTED", "PAUSED", "ERROR", "IDLE"],
  TRANSCRIBING: ["THINKING", "ERROR", "INTERRUPTED", "READY"],
  THINKING: ["SPEAKING", "READY", "ERROR", "INTERRUPTED"],
  SPEAKING: ["INTERRUPTED", "RECORDING", "TRANSCRIBING", "READY", "PAUSED", "COMPLETED", "ERROR", "IDLE"],
  INTERRUPTED: ["RECORDING", "READY", "IDLE", "ERROR"],
  PAUSED: ["READY", "RECORDING", "IDLE", "ERROR"],
  ERROR: ["READY", "IDLE", "RECORDING", "REQUESTING_MIC_PERMISSION"],
  COMPLETED: ["IDLE", "READY"],
};

export class SpeakingStateMachine {
  private currentState: SpeakingState = "IDLE";
  private lastReason: string | null = null;
  private lastError: string | null = null;
  private listeners: Array<(state: SpeakingState, reason?: string) => void> = [];

  public getState(): SpeakingState {
    return this.currentState;
  }

  public getReason(): string | null {
    return this.lastReason;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public subscribe(listener: (state: SpeakingState, reason?: string) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Performs an explicit state transition with graph validation.
   */
  public transitionTo(nextState: SpeakingState, reason?: string): boolean {
    const validNextStates = VALID_TRANSITIONS[this.currentState] ?? [];

    if (!validNextStates.includes(nextState)) {
      const msg = `Invalid state transition requested: Cannot transition from '${this.currentState}' to '${nextState}'. Valid target states are: ${validNextStates.join(", ")}`;
      logger.error("State machine invalid transition attempted", {
        currentState: this.currentState,
        nextState,
        reason,
      });
      throw AppError.validation(msg);
    }

    const previous = this.currentState;
    this.currentState = SpeakingStateSchema.parse(nextState);
    this.lastReason = reason ?? null;

    if (nextState === "ERROR") {
      this.lastError = reason ?? "An unexpected error occurred in speaking session.";
    } else {
      this.lastError = null;
    }

    logger.info("Speaking session state transition", {
      from: previous,
      to: this.currentState,
      reason,
    });

    for (const listener of this.listeners) {
      try {
        listener(this.currentState, reason);
      } catch (err) {
        logger.error("Error in state machine listener callback", {}, err);
      }
    }

    return true;
  }

  /**
   * Force reset machine to IDLE or READY state after error recovery.
   */
  public reset(targetState: "IDLE" | "READY" = "IDLE"): void {
    this.currentState = targetState;
    this.lastReason = "Reset requested";
    this.lastError = null;
    for (const listener of this.listeners) {
      listener(this.currentState, "Reset");
    }
  }
}

export const speakingStateMachine = new SpeakingStateMachine();
