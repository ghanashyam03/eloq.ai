import { describe, it, expect } from "vitest";
import "@/lib/config/env"; // Ensures process.env.DATABASE_URL fallback is initialized
import { seedDatabase } from "../prisma/seed";

describe("Database Seed & Schema Taxonomy", () => {
  it("should define seedDatabase function for canonical taxonomies", () => {
    expect(seedDatabase).toBeDefined();
    expect(typeof seedDatabase).toBe("function");
  });
});
