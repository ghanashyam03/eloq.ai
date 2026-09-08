import { describe, it, expect } from "vitest";
import { AppError } from "@/lib/errors/app-error";

describe("AppError Taxonomy", () => {
  it("should create validation error with status code 400 and details", () => {
    const err = AppError.validation("Invalid email format", { field: "email" });
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Invalid email format");
    expect(err.details).toEqual({ field: "email" });
  });

  it("should create authentication error with status code 401", () => {
    const err = AppError.authentication();
    expect(err.code).toBe("AUTHENTICATION_ERROR");
    expect(err.statusCode).toBe(401);
  });

  it("should create external provider error with status code 502", () => {
    const err = AppError.externalProvider("OpenAI", "API key invalid");
    expect(err.code).toBe("EXTERNAL_PROVIDER_ERROR");
    expect(err.statusCode).toBe(502);
    expect(err.message).toContain("[OpenAI]");
  });

  it("should serialize error to user-facing response without leaking stack traces", () => {
    const err = AppError.validation("Payload error", { issue: "too_short" });
    const response = err.toResponse("req-123");

    expect(response).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Payload error",
        requestId: "req-123",
        details: { issue: "too_short" },
      },
    });

    // Verify stack is omitted from response JSON
    expect((response as unknown as Record<string, unknown>)["stack"]).toBeUndefined();
  });
});
