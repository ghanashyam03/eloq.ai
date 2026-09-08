import { z } from "zod";

export const WeaknessTrendSchema = z.enum([
  "improving",
  "stable",
  "worsening",
  "insufficient_evidence",
]);
export type WeaknessTrend = z.infer<typeof WeaknessTrendSchema>;

export const WeaknessStatusSchema = z.enum([
  "active",
  "improving",
  "mastered",
  "relapsed",
]);
export type WeaknessStatus = z.infer<typeof WeaknessStatusSchema>;

export const ErrorSignatureSchema = z.object({
  category: z.string(),
  subcategory: z.string(),
  canonicalPattern: z.string(),
  normalizedKey: z.string(), // e.g. "grammar:preposition:interested_in"
});
export type ErrorSignature = z.infer<typeof ErrorSignatureSchema>;

export const ContextDistributionSchema = z.object({
  speaking: z.number().int().nonnegative().default(0),
  writing: z.number().int().nonnegative().default(0),
  conversation: z.number().int().nonnegative().default(0),
  exercise: z.number().int().nonnegative().default(0),
});
export type ContextDistribution = z.infer<typeof ContextDistributionSchema>;

export const WeaknessEvidenceItemSchema = z.object({
  id: z.string().uuid(),
  normalizedKey: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  subcategory: z.string(),
  occurrenceCount: z.number().int().nonnegative(),
  distinctSessionCount: z.number().int().nonnegative(),
  firstDetectedAt: z.date(),
  lastDetectedAt: z.date(),
  averageSeverity: z.number().min(1.0).max(5.0),
  averageConfidence: z.number().min(0.0).max(1.0),
  priorityScore: z.number().min(0.0),
  masteryEstimate: z.number().min(0.0).max(1.0), // 0% to 100%
  trend: WeaknessTrendSchema,
  status: WeaknessStatusSchema,
  contextDistribution: ContextDistributionSchema,
  sampleExamples: z.array(
    z.object({
      originalText: z.string(),
      correctedText: z.string(),
      explanation: z.string(),
      detectedAt: z.date(),
    })
  ).default([]),
});
export type WeaknessEvidenceItem = z.infer<typeof WeaknessEvidenceItemSchema>;

export const UserWeaknessProfileSchema = z.object({
  userId: z.string().uuid(),
  topWeaknesses: z.array(WeaknessEvidenceItemSchema),
  topImprovingSkills: z.array(WeaknessEvidenceItemSchema),
  persistentWeaknesses: z.array(WeaknessEvidenceItemSchema),
  recentlyEmergingWeaknesses: z.array(WeaknessEvidenceItemSchema),
  relapsedWeaknesses: z.array(WeaknessEvidenceItemSchema),
  generatedAt: z.date(),
});
export type UserWeaknessProfile = z.infer<typeof UserWeaknessProfileSchema>;
