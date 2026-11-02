import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok, okWithMeta } from '../../lib/http.js';
import { pageMeta } from '../../lib/pagination.js';
import { validationHook } from '../../lib/validator.js';
import { requireUser } from '../../middleware/auth.js';
import { createReminderSchema, listRemindersQuerySchema, reminderParamSchema, snoozeReminderSchema, updateReminderSchema } from './reminders.schemas.js';
import { createReminder, deleteReminder, dismissReminder, getReminder, listReminders, snoozeReminder, updateReminder } from './reminders.service.js';

// The owner always comes from the verified claims, never from the body.
export default new Hono<AppEnv>()
	.use(requireUser())
	.get('/', zValidator('query', listRemindersQuerySchema, validationHook), async c => {
		const { page, pageSize, ...filters } = c.req.valid('query');
		const { items, total } = await listReminders(c.get('prisma'), c.get('claims').sub, filters, { page, pageSize });
		return okWithMeta(c, items, pageMeta({ page, pageSize }, total), 200);
	})
	.post('/', zValidator('json', createReminderSchema, validationHook), async c => ok(c, await createReminder(c.get('prisma'), c.get('claims').sub, c.req.valid('json')), 201))
	.get('/:id', zValidator('param', reminderParamSchema, validationHook), async c => ok(c, await getReminder(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200))
	.patch('/:id', zValidator('param', reminderParamSchema, validationHook), zValidator('json', updateReminderSchema, validationHook), async c =>
		ok(c, await updateReminder(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json')), 200)
	)
	.post('/:id/snooze', zValidator('param', reminderParamSchema, validationHook), zValidator('json', snoozeReminderSchema, validationHook), async c =>
		ok(c, await snoozeReminder(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json')), 200)
	)
	.post('/:id/dismiss', zValidator('param', reminderParamSchema, validationHook), async c => ok(c, await dismissReminder(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200))
	.delete('/:id', zValidator('param', reminderParamSchema, validationHook), async c => {
		const { id } = c.req.valid('param');
		await deleteReminder(c.get('prisma'), c.get('claims').sub, id);
		return ok(c, { id }, 200);
	});
