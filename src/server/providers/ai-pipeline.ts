import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface ValidationPipelineOptions<TDomain> {
  providerName: string;
  operationName: string;
  schema: z.ZodType<TDomain>;
  transform?: (validatedData: TDomain) => TDomain;
}

/**
 * Enforces the strict AI validation pipeline:
 * External Model Output -> Raw Extraction -> JSON Parsing -> Zod Validation -> Domain Object
 */
export async function executeAIPipeline<TDomain>(
  rawProviderOutput: unknown,
  options: ValidationPipelineOptions<TDomain>
): Promise<TDomain> {
  const startTime = Date.now();
  const { providerName, operationName, schema, transform } = options;

  let jsonPayload: unknown;

  // Step 1: Raw Output Extraction & JSON Parsing
  try {
    if (typeof rawProviderOutput === "string") {
      // Strip markdown code fences if model returned ```json ... ```
      const cleaned = rawProviderOutput
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "")
        .trim();

      jsonPayload = JSON.parse(cleaned);
    } else if (typeof rawProviderOutput === "object" && rawProviderOutput !== null) {
      jsonPayload = rawProviderOutput;
    } else {
      throw new Error(`Unexpected raw AI output type: ${typeof rawProviderOutput}`);
    }
  } catch (parseError) {
    logger.error("AI output JSON parsing failed", {
      provider: providerName,
      operation: operationName,
      latencyMs: Date.now() - startTime,
    }, parseError);

    throw AppError.externalProvider(
      providerName,
      `Failed to parse raw JSON output from model during ${operationName}`,
      parseError
    );
  }

  // Step 2: Zod Schema Validation
  const validationResult = schema.safeParse(jsonPayload);

  if (!validationResult.success) {
    logger.error("AI output schema validation failed", {
      provider: providerName,
      operation: operationName,
      errorCategory: "VALIDATION_ERROR",
      latencyMs: Date.now() - startTime,
      validationIssues: validationResult.error.issues,
    });

    throw AppError.validation(
      `AI model output for '${operationName}' failed domain schema validation`,
      validationResult.error.issues
    );
  }

  // Step 3: Domain Transformation & Final Return
  const validatedDomainObject = validationResult.data;
  const finalObject = transform ? transform(validatedDomainObject) : validatedDomainObject;

  logger.info("AI validation pipeline succeeded", {
    provider: providerName,
    operation: operationName,
    latencyMs: Date.now() - startTime,
  });

  return finalObject;
}
