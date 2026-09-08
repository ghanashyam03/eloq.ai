import { ErrorCategory } from "../errors/app-error";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  operation?: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  errorCategory?: ErrorCategory;
  userId?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "authorization",
  "apikey",
  "api_key",
  "key",
  "audio_payload",
  "raw_audio",
  "audio_buffer",
  "bearer",
]);

/**
 * Recursively redacts sensitive keys from log metadata payloads.
 */
export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    if (data.startsWith("sk-") || data.length > 1000) {
      return "[REDACTED_OR_TRUNCATED]";
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }

  if (typeof data === "object") {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitizedObj[key] = "[REDACTED]";
      } else {
        sanitizedObj[key] = sanitizeLogData(value);
      }
    }
    return sanitizedObj;
  }

  return data;
}

export class Logger {
  private static instance: Logger;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: unknown
  ): string {
    const timestamp = new Date().toISOString();
    const sanitizedContext = context ? (sanitizeLogData(context) as LogContext) : {};

    const logEntry = {
      timestamp,
      level,
      message,
      ...sanitizedContext,
      ...(error instanceof Error
        ? {
            errorName: error.name,
            errorMessage: error.message,
            stack: process.env["NODE_ENV"] === "development" ? error.stack : undefined,
          }
        : {}),
    };

    if (process.env["NODE_ENV"] === "production") {
      return JSON.stringify(logEntry);
    }

    const reqStr = sanitizedContext.requestId ? ` [Req: ${sanitizedContext.requestId}]` : "";
    const opStr = sanitizedContext.operation ? ` [Op: ${sanitizedContext.operation}]` : "";
    const provStr = sanitizedContext.provider ? ` [Prov: ${sanitizedContext.provider}]` : "";
    const latStr =
      typeof sanitizedContext.latencyMs === "number" ? ` (${sanitizedContext.latencyMs}ms)` : "";

    return `[${timestamp}] [${level.toUpperCase()}]${reqStr}${opStr}${provStr}: ${message}${latStr}`;
  }

  public info(message: string, context?: LogContext): void {
    console.info(this.formatMessage("info", message, context));
  }

  public warn(message: string, context?: LogContext, error?: unknown): void {
    console.warn(this.formatMessage("warn", message, context, error));
  }

  public error(message: string, context?: LogContext, error?: unknown): void {
    console.error(this.formatMessage("error", message, context, error));
  }

  public debug(message: string, context?: LogContext): void {
    if (process.env["NODE_ENV"] !== "production") {
      console.debug(this.formatMessage("debug", message, context));
    }
  }
}

export const logger = Logger.getInstance();
