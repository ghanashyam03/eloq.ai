import { describe, it, expect, beforeEach } from "vitest";
import { SpeakingStateMachine } from "@/server/speech/speaking-state-machine";

describe("Speaking State Machine", () => {
  let machine: SpeakingStateMachine;

  beforeEach(() => {
    machine = new SpeakingStateMachine();
  });

  it("should start in IDLE state", () => {
    expect(machine.getState()).toBe("IDLE");
  });

  it("should perform valid sequential state transitions", () => {
    expect(machine.transitionTo("REQUESTING_MIC_PERMISSION")).toBe(true);
    expect(machine.getState()).toBe("REQUESTING_MIC_PERMISSION");

    expect(machine.transitionTo("READY")).toBe(true);
    expect(machine.getState()).toBe("READY");

    expect(machine.transitionTo("RECORDING")).toBe(true);
    expect(machine.getState()).toBe("RECORDING");

    expect(machine.transitionTo("TRANSCRIBING")).toBe(true);
    expect(machine.getState()).toBe("TRANSCRIBING");

    expect(machine.transitionTo("THINKING")).toBe(true);
    expect(machine.getState()).toBe("THINKING");

    expect(machine.transitionTo("SPEAKING")).toBe(true);
    expect(machine.getState()).toBe("SPEAKING");
  });

  it("should reject invalid state transitions", () => {
    expect(() => machine.transitionTo("SPEAKING")).toThrow("Invalid state transition requested");
  });

  it("should support barge-in transition from SPEAKING to INTERRUPTED to RECORDING", () => {
    machine.transitionTo("READY");
    machine.transitionTo("RECORDING");
    machine.transitionTo("TRANSCRIBING");
    machine.transitionTo("THINKING");
    machine.transitionTo("SPEAKING");

    expect(machine.transitionTo("INTERRUPTED", "Barge-in user speech")).toBe(true);
    expect(machine.getState()).toBe("INTERRUPTED");

    expect(machine.transitionTo("RECORDING", "User started speaking")).toBe(true);
    expect(machine.getState()).toBe("RECORDING");
  });

  it("should notify subscribed listeners on state changes", () => {
    const states: string[] = [];
    machine.subscribe((state) => states.push(state));

    machine.transitionTo("READY");
    machine.transitionTo("RECORDING");

    expect(states).toEqual(["READY", "RECORDING"]);
  });
});
