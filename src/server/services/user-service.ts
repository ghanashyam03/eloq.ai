import { db } from "../db/client";
import { User, UserSettings, UserSettingsSchema } from "@/domain/users/user.schema";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface CreateUserDTO {
  email: string;
  name?: string | undefined;
  targetProficiency?: string | undefined;
  preferredVoice?: string | undefined;
}

export class UserService {
  private mapToUserDomain(dbUser: { id: string; email: string; name: string | null; createdAt: Date; updatedAt: Date }): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
      ...(dbUser.name ? { name: dbUser.name } : {}),
    };
  }

  /**
   * Retrieves a user by their unique ID.
   */
  async getUserById(id: string): Promise<User | null> {
    try {
      const dbUser = await db.user.findUnique({
        where: { id },
      });
      if (!dbUser) return null;
      return this.mapToUserDomain(dbUser);
    } catch (error) {
      logger.error("Failed to fetch user by ID", { userId: id, operation: "getUserById" }, error);
      throw AppError.database("Error fetching user from database", error);
    }
  }

  /**
   * Creates a user along with default settings in a single transaction.
   */
  async createUser(dto: CreateUserDTO): Promise<{ user: User; settings: UserSettings }> {
    const operation = "createUser";
    try {
      const result = await db.$transaction(async (tx) => {
        const dbUser = await tx.user.create({
          data: {
            email: dto.email,
            ...(dto.name !== undefined ? { name: dto.name } : {}),
          },
        });

        const dbSettings = await tx.userSettings.create({
          data: {
            userId: dbUser.id,
            targetProficiency: dto.targetProficiency ?? "B2",
            preferredVoice: dto.preferredVoice ?? "en-US-Standard-C",
          },
        });

        return { dbUser, dbSettings };
      });

      const user = this.mapToUserDomain(result.dbUser);
      const validatedSettings = UserSettingsSchema.parse(result.dbSettings);

      logger.info("Created new user entity", { userId: user.id, operation });
      return { user, settings: validatedSettings };
    } catch (error) {
      logger.error("Failed to create user entity", { email: dto.email, operation }, error);
      throw AppError.database("Error creating user entity in database", error);
    }
  }
}

export const userService = new UserService();
