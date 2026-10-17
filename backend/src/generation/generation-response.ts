/**
 * Spec 01, NFR-SEC-011 / AC-SEC-015: the shape of a generation in user-facing responses.
 *
 * The `prompt` column holds the internal instruction sent to the image model (or the AI-rewritten
 * version of the user's own style text) and the image `description` is the model's analysis of the
 * photo – both are internal and only shown in the admin panel. Responses are built from this allow-list,
 * so a column added later is hidden until it is deliberately exposed here.
 */
export const USER_GENERATION_FIELDS = [
  'id',
  'imageId',
  'url',
  'style',
  'status',
  'rating',
  'ratingReason',
  'createdAt',
  'updatedAt',
] as const;

export type UserGenerationField = (typeof USER_GENERATION_FIELDS)[number];
export type UserGeneration = Partial<Record<UserGenerationField, unknown>>;

export function toUserGeneration(generation: Record<string, unknown>): UserGeneration {
  const out: UserGeneration = {};
  for (const field of USER_GENERATION_FIELDS) {
    if (field in generation) out[field] = generation[field];
  }
  return out;
}
