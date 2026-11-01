/**
 * Generic payload diff for PATCH/PUT updates. A request that changes nothing is idempotent: the service answers 200 with the current
 * resource and writes nothing (no `updatedAt` bump, no history events, no link replacement).
 *
 * @example
 * const changed = changedFields({ ...goal }, input);
 * if (!hasChanges(changed)) return goal;
 * await prisma.goal.updateMany({ data: changed, where: scoped(ownerId, { id }) });
 */

/** True when the object has at least one key. Use as the `empty_update` refinement of PATCH schemas. */
export const hasChanges = (value: object): boolean => Object.keys(value).length > 0;

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

/**
 * Value equality for what comes out of Prisma and Zod: primitives, `Date` (by time), arrays, plain objects (recursively).
 * `null` and `undefined` are the same "no value". With `unordered`, arrays are compared as multisets (order ignored).
 */
export const valuesEqual = (a: unknown, b: unknown, unordered = false): boolean => {
	if (a === undefined || a === null || b === undefined || b === null) return (a ?? null) === (b ?? null);
	if (Object.is(a, b)) return true;
	if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!(Array.isArray(a) && Array.isArray(b)) || a.length !== b.length) return false;
		if (!unordered) return a.every((item, index) => valuesEqual(item, b[index]));
		const pending = [...b];
		return a.every(item => {
			const index = pending.findIndex(candidate => valuesEqual(item, candidate));
			if (index === -1) return false;
			pending.splice(index, 1);
			return true;
		});
	}
	if (isPlainObject(a) && isPlainObject(b)) {
		const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
		return [...keys].every(key => valuesEqual(a[key], b[key]));
	}
	return false;
};

export type DiffOptions = {
	/** Keys whose array values are sets: the order does not count as a change (e.g. `tagIds`). */
	unordered?: readonly string[];
};

/**
 * The fields of `patch` whose value differs from the stored one in `current`. Keys the patch does not carry (or carries as `undefined`)
 * are ignored; `null` in the patch means "clear it" and only counts when the stored value is not already empty.
 * `current` may be any object holding the comparable stored values (build it with derived keys such as `tagIds` when needed).
 */
export const changedFields = <P extends object>(current: object, patch: P, options: DiffOptions = {}): Partial<P> => {
	const stored = current as Record<string, unknown>;
	const changed: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(patch)) {
		if (value === undefined) continue;
		if (!valuesEqual(stored[key], value, options.unordered?.includes(key))) changed[key] = value;
	}
	return changed as Partial<P>;
};
