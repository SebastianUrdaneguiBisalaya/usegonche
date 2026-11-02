import type { Reminder } from '@usegonche/database';

/**
 * Delivery channel stub. The channel (Expo push, Web Push, email...) is a separate decision: plug it in here.
 * Throwing means "not delivered": the processor puts the reminder back to `pending` so the next run retries it.
 */
export const deliverReminder = async (_reminder: Reminder): Promise<void> => {
	// Intentionally empty until a delivery channel is chosen.
};
