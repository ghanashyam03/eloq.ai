import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { userService, CreateUserDTO } from "@/server/services/user-service";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

const createUserApiSchema = z.object({
  email: z.string().email("A valid email address is required"),
  name: z.string().min(1).optional(),
  targetProficiency: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).optional(),
  preferredVoice: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      throw AppError.validation("Request body must be valid JSON");
    }

    const validationResult = createUserApiSchema.safeParse(rawBody);
    if (!validationResult.success) {
      throw AppError.validation("Invalid user input payload", validationResult.error.issues);
    }

    const parsedData = validationResult.data;
    const dto: CreateUserDTO = {
      email: parsedData.email,
      ...(parsedData.name !== undefined ? { name: parsedData.name } : {}),
      ...(parsedData.targetProficiency !== undefined ? { targetProficiency: parsedData.targetProficiency } : {}),
      ...(parsedData.preferredVoice !== undefined ? { preferredVoice: parsedData.preferredVoice } : {}),
    };

    const result = await userService.createUser(dto);

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      logger.warn("API request failed with operational error", {
        requestId,
        operation: "createUserApi",
        errorCategory: error.code,
      });
      return NextResponse.json(error.toResponse(requestId), { status: error.statusCode });
    }

    logger.error("Unhandled API error", { requestId, operation: "createUserApi" }, error);
    const internalError = AppError.internal("An unexpected error occurred");
    return NextResponse.json(internalError.toResponse(requestId), { status: 500 });
  }
}
