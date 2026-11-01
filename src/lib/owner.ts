/**
 * Owner scoping for services. Every user-owned table has `ownerId`; wrap every `where` with this so a query can
 * never read or mutate another user's data. `ownerId` is applied last, so it cannot be overridden by `where`.
 *
 * @example prisma.tag.findMany({ where: scoped(userId, { name: 'work' }) })
 */
export const scoped = <T extends object>(ownerId: string, where?: T): Omit<T, 'ownerId'> & { ownerId: string } => ({ ...where, ownerId }) as Omit<T, 'ownerId'> & { ownerId: string };
