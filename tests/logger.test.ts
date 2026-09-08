import { describe, it, expect } from "vitest";
import { sanitizeLogData } from "@/lib/logger/logger";

describe("Logger Sanitization", () => {
  it("should redact sensitive fields like password, api_key, and token", () => {
    const rawData = {
      user: "john_doe",
      password: "SuperSecretPassword123!",
      api_key: "sk-proj-123456789",
      nested: {
        token: "bearer_abc_xyz",
        validKey: "safe_value",
      },
    };

    const sanitized = sanitizeLogData(rawData) as Record<string, unknown>;

    expect(sanitized["user"]).toBe("john_doe");
    expect(sanitized["password"]).toBe("[REDACTED]");
    expect(sanitized["api_key"]).toBe("[REDACTED]");
    const nested = sanitized["nested"] as Record<string, unknown>;
    expect(nested["token"]).toBe("[REDACTED]");
    expect(nested["validKey"]).toBe("safe_value");
  });

  it("should redact raw audio payloads to prevent logging huge binary data", () => {
    const rawData = {
      operation: "stt_transcribe",
      raw_audio: "binary_stream_data...",
    };

    const sanitized = sanitizeLogData(rawData) as Record<string, unknown>;

    expect(sanitized["operation"]).toBe("stt_transcribe");
    expect(sanitized["raw_audio"]).toBe("[REDACTED]");
  });
});
