/** True when Prisma rejected a write because of a unique constraint (error code P2002). */
export const isUniqueViolation = (error: unknown): boolean => typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';
