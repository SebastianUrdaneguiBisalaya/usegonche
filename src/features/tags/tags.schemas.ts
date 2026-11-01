import { z } from 'zod';

const name = z.string().trim().min(1).max(50);

export const createTagSchema = z.strictObject({ name });
export const updateTagSchema = z.strictObject({ name });
export const tagParamSchema = z.object({ id: z.uuid() });

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
