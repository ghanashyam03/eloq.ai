import { LLMTaskType } from "../registry/model-task.types";
import { logger } from "@/lib/logger/logger";
import { ErrorCategory } from "@/lib/errors/app-error";

export interface UsageMetricRecord {
  id: string;
  timestamp: Date;
  taskType: LLMTaskType;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  success: boolean;
  errorCategory?: ErrorCategory;
}

/**
 * In-memory usage tracker collecting LLM metrics for quota monitoring and diagnostics.
 * Strictly sanitizes data to guarantee no API keys or PII are logged or stored.
 */
export class UsageTracker {
  private static instance: UsageTracker;
  private readonly records: UsageMetricRecord[] = [];

  private constructor() {}

  public static getInstance(): UsageTracker {
    if (!UsageTracker.instance) {
      UsageTracker.instance = new UsageTracker();
    }
    return UsageTracker.instance;
  }

  public recordUsage(metric: Omit<UsageMetricRecord, "id" | "timestamp">): UsageMetricRecord {
    const record: UsageMetricRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...metric,
    };

    this.records.push(record);

    // Keep records capped in memory to avoid unconstrained growth
    if (this.records.length > 5000) {
      this.records.shift();
    }

    logger.info("Recorded LLM provider usage metric", {
      provider: record.provider,
      model: record.model,
      taskType: record.taskType,
      latencyMs: record.latencyMs,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      success: record.success,
      ...(record.errorCategory ? { errorCategory: record.errorCategory } : {}),
    });

    return record;
  }

  public getMetrics(): readonly UsageMetricRecord[] {
    return [...this.records];
  }

  public clear(): void {
    this.records.length = 0;
  }
}

export const usageTracker = UsageTracker.getInstance();
