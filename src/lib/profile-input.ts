import { z } from "zod";

const shortName = z.string().trim().min(1).max(200);
const avatarUrl = z.union([
  z.string().trim().max(2048).url().refine(value => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS avatar URL"),
  z.literal(""),
  z.null(),
]).transform(value => value || null);

export const profileUpdateSchema = z.object({
  full_name: shortName.optional(),
  avatar_url: avatarUrl.optional(),
  // Settings sends the GET response back to PUT. These known read-only fields
  // are accepted for compatibility, but are never included in the DB update.
  email: z.string().email().optional(),
  id: z.string().optional(),
  demo: z.boolean().optional(),
  persisted: z.boolean().optional(),
}).strict().transform(value => ({
  ...(value.full_name !== undefined ? { full_name: value.full_name } : {}),
  ...(value.avatar_url !== undefined ? { avatar_url: value.avatar_url } : {}),
})).refine(value => Object.keys(value).length > 0, "No writable profile fields provided");

export const onboardingSchema = z.object({
  full_name: shortName,
  program_name: shortName,
  university: z.string().trim().max(200),
  gpa_scale: z.enum(["4.0", "100"]).transform(Number),
  study_hours_per_week: z.number().int().min(0).max(168),
  primary_language: z.enum(["en", "ar"]),
  goal: z.enum(["gpa", "skills", "career", "research"]),
}).strict();

export type OnboardingData = z.input<typeof onboardingSchema>;
