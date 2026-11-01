import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { createTemplate, deleteTemplate, getTemplate, instantiateTemplate, listTemplates, updateTemplate } from './templates.service.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const TAG_ID = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const REF_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const tag = { id: TAG_ID, name: 'work' };
const START = new Date('2026-11-02T00:00:00Z');

const itemRow = (extra: object = {}) => ({ description: null, dueOffsetDays: null, estimatedMinutes: null, id: 'i1', parentId: null, priority: 'medium', tags: [], title: 'Task', ...extra });
const taskTemplate = {
	description: null,
	id: ID,
	items: [itemRow({ dueOffsetDays: 2, tags: [{ tag }] }), itemRow({ dueOffsetDays: 3, id: 'i2', parentId: 'i1', title: 'Sub' })],
	kind: 'task',
	name: 'Fix a bug',
	ownerId: TEST_USER_ID,
	tags: [],
	title: null,
};
const projectTemplate = {
	description: 'Plan it',
	id: ID,
	items: [itemRow({ id: 'i1', title: 'Kickoff' }), itemRow({ id: 'i2', title: 'Ship' }), itemRow({ id: 'i3', parentId: 'i2', title: 'QA' })],
	kind: 'project',
	name: 'Launch',
	ownerId: TEST_USER_ID,
	tags: [{ tag }],
	title: 'Launch project',
};

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);
const setup = (row: unknown = taskTemplate) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.template.findFirst).mockResolvedValue(asRow(row));
	vi.mocked(prisma.templateItem.create).mockResolvedValue(asRow({ id: 'new-item' }));
	vi.mocked(prisma.template.create).mockResolvedValue(asRow({ id: ID }));
	vi.mocked(prisma.tag.count).mockResolvedValue(1);
	return prisma;
};
const taskDataOf = (prisma: ReturnType<typeof createMockPrisma>) => vi.mocked(prisma.task.create).mock.calls.map(call => call[0]?.data);

describe('getTemplate', () => {
	it('builds the tree: tasks with their subtasks and flat tags', async () => {
		const prisma = setup();
		const view = await getTemplate(prisma, TEST_USER_ID, ID);
		expect(view.items).toHaveLength(1);
		expect(view.items[0]).toMatchObject({ id: 'i1', subtasks: [{ id: 'i2', title: 'Sub' }], tags: [tag] });
		expect(view.items[0]?.subtasks[0]).not.toHaveProperty('parentId');
		expect(vi.mocked(prisma.template.findFirst).mock.calls[0]?.[0]?.where).toEqual({ id: ID, ownerId: TEST_USER_ID });
	});

	it('throws 404 for another owner', async () => {
		const prisma = setup(null);
		expect(await rejection(getTemplate(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
	});
});

describe('listTemplates', () => {
	it('scopes by owner and filters by kind', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.template.findMany).mockResolvedValue([]);
		await listTemplates(prisma, TEST_USER_ID, 'project', 20);
		expect(prisma.template.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 21, where: { kind: 'project', ownerId: TEST_USER_ID } }));
		await listTemplates(prisma, TEST_USER_ID, undefined, 20);
		expect(vi.mocked(prisma.template.findMany).mock.calls[1]?.[0]?.where).toEqual({ ownerId: TEST_USER_ID });
	});
});

describe('createTemplate', () => {
	const subtask = { priority: 'medium' as const, subtasks: [], tagIds: [], title: 'Sub' };
	const item = { priority: 'high' as const, subtasks: [subtask], tagIds: [TAG_ID], title: 'Task' };

	it('creates a task template with its item and subtasks (parent, position, owner)', async () => {
		const prisma = setup();
		await createTemplate(prisma, TEST_USER_ID, { item, kind: 'task', name: 'Fix a bug' });
		expect(vi.mocked(prisma.template.create).mock.calls[0]?.[0]?.data).toMatchObject({ kind: 'task', name: 'Fix a bug', ownerId: TEST_USER_ID });
		const [root, sub] = vi.mocked(prisma.templateItem.create).mock.calls.map(call => call[0]?.data);
		expect(root).toMatchObject({ ownerId: TEST_USER_ID, parentId: undefined, position: 0, priority: 'high', tags: { create: [{ tagId: TAG_ID }] }, templateId: ID, title: 'Task' });
		expect(sub).toMatchObject({ parentId: 'new-item', position: 0, title: 'Sub' });
	});

	it('creates a project template with its own fields, tags and tasks in order', async () => {
		const prisma = setup(projectTemplate);
		await createTemplate(prisma, TEST_USER_ID, {
			description: 'Plan it',
			items: [
				{ ...subtask, title: 'A' },
				{ ...subtask, title: 'B' },
			],
			kind: 'project',
			name: 'Launch',
			tagIds: [TAG_ID],
			title: 'Launch project',
		});
		expect(vi.mocked(prisma.template.create).mock.calls[0]?.[0]?.data).toMatchObject({ description: 'Plan it', kind: 'project', tags: { create: [{ tagId: TAG_ID }] }, title: 'Launch project' });
		expect(vi.mocked(prisma.templateItem.create).mock.calls.map(call => call[0]?.data.position)).toEqual([0, 1]);
	});

	it.each([['project tags', (p: ReturnType<typeof createMockPrisma>) => vi.mocked(p.tag.count).mockResolvedValue(0)]])(
		'rejects %s that are not the owner’s with 422 and writes nothing',
		async (_name, arrange) => {
			const prisma = setup();
			arrange(prisma);
			expect(await rejection(createTemplate(prisma, TEST_USER_ID, { item, kind: 'task', name: 'x' }))).toMatchObject({ details: [{ code: 'not_found', field: 'tagIds' }], status: 422 });
			expect(prisma.template.create).not.toHaveBeenCalled();
		}
	);
});

describe('updateTemplate', () => {
	const same = {
		priority: 'medium' as const,
		subtasks: [{ dueOffsetDays: 3, priority: 'medium' as const, subtasks: [], tagIds: [], title: 'Sub' }],
		tagIds: [TAG_ID],
		title: 'Task',
		dueOffsetDays: 2,
	};

	it('writes nothing when the payload changes nothing (same name, same structure)', async () => {
		const prisma = setup();
		await updateTemplate(prisma, TEST_USER_ID, ID, { item: same, name: 'Fix a bug' });
		expect(prisma.template.updateMany).not.toHaveBeenCalled();
		expect(prisma.templateItem.deleteMany).not.toHaveBeenCalled();
		expect(prisma.templateItem.create).not.toHaveBeenCalled();
	});

	it('renames without touching the structure', async () => {
		const prisma = setup();
		await updateTemplate(prisma, TEST_USER_ID, ID, { name: 'New name' });
		expect(prisma.template.updateMany).toHaveBeenCalledWith({ data: { name: 'New name' }, where: { id: ID, ownerId: TEST_USER_ID } });
		expect(prisma.templateItem.deleteMany).not.toHaveBeenCalled();
	});

	it('replaces the whole structure when it differs', async () => {
		const prisma = setup();
		await updateTemplate(prisma, TEST_USER_ID, ID, { item: { ...same, title: 'Changed' } });
		expect(prisma.templateItem.deleteMany).toHaveBeenCalledWith({ where: { ownerId: TEST_USER_ID, templateId: ID } });
		expect(vi.mocked(prisma.templateItem.create).mock.calls[0]?.[0]?.data).toMatchObject({ title: 'Changed' });
	});

	it('updates project fields, tags and tasks of a project template', async () => {
		const prisma = setup(projectTemplate);
		await updateTemplate(prisma, TEST_USER_ID, ID, { description: null, items: [{ priority: 'medium', subtasks: [], tagIds: [], title: 'Only' }], tagIds: [], title: 'Renamed' });
		expect(prisma.template.updateMany).toHaveBeenCalledWith({ data: { description: null, title: 'Renamed' }, where: { id: ID, ownerId: TEST_USER_ID } });
		expect(prisma.templateTag.deleteMany).toHaveBeenCalledWith({ where: { templateId: ID } });
		expect(prisma.templateItem.deleteMany).toHaveBeenCalled();
	});

	it('rejects fields that do not apply to the kind with 422 not_applicable', async () => {
		expect(await rejection(updateTemplate(setup(), TEST_USER_ID, ID, { title: 'x' }))).toMatchObject({ details: [{ code: 'not_applicable', field: 'title' }], status: 422 });
		expect(await rejection(updateTemplate(setup(projectTemplate), TEST_USER_ID, ID, { item: same }))).toMatchObject({ details: [{ code: 'not_applicable', field: 'item' }], status: 422 });
	});

	it('rejects tags that are not the owner’s and throws 404 for another owner', async () => {
		const prisma = setup(projectTemplate);
		vi.mocked(prisma.tag.count).mockResolvedValue(0);
		expect(await rejection(updateTemplate(prisma, TEST_USER_ID, ID, { tagIds: [REF_ID] }))).toMatchObject({ status: 422 });
		expect(await rejection(updateTemplate(setup(null), OTHER_USER_ID, ID, { name: 'x' }))).toMatchObject({ code: 'not_found', status: 404 });
	});
});

describe('deleteTemplate', () => {
	it('deletes scoped by owner and throws 404 when nothing matches', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.template.deleteMany).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
		await deleteTemplate(prisma, TEST_USER_ID, ID);
		expect(prisma.template.deleteMany).toHaveBeenCalledWith({ where: { id: ID, ownerId: TEST_USER_ID } });
		expect(await rejection(deleteTemplate(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
	});
});

describe('instantiateTemplate', () => {
	it('creates the task and its subtasks with origin template, tags and due dates from the start date', async () => {
		const prisma = setup();
		vi.mocked(prisma.task.create)
			.mockResolvedValueOnce(asRow({ id: 't1' }))
			.mockResolvedValueOnce(asRow({ id: 't2' }));
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow({ id: REF_ID }));
		const result = await instantiateTemplate(prisma, TEST_USER_ID, ID, { projectId: REF_ID, startDate: START });
		expect(result).toEqual({ projectId: REF_ID, taskIds: ['t1', 't2'] });
		const [task, subtask] = taskDataOf(prisma);
		expect(task).toMatchObject({
			dueDate: new Date('2026-11-04T00:00:00Z'),
			origin: 'template',
			ownerId: TEST_USER_ID,
			parentId: null,
			projectId: REF_ID,
			tags: { create: [{ tagId: TAG_ID }] },
			title: 'Task',
		});
		expect(subtask).toMatchObject({ dueDate: new Date('2026-11-05T00:00:00Z'), parentId: 't1', projectId: REF_ID, title: 'Sub' });
	});

	it('lets the title override the created task and sets the goal', async () => {
		const prisma = setup({ ...taskTemplate, items: [itemRow()] });
		vi.mocked(prisma.task.create).mockResolvedValue(asRow({ id: 't1' }));
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(asRow({ id: REF_ID }));
		await instantiateTemplate(prisma, TEST_USER_ID, ID, { goalId: REF_ID, title: 'Fix login' });
		expect(taskDataOf(prisma)[0]).toMatchObject({ dueDate: undefined, goalId: REF_ID, title: 'Fix login' });
	});

	it('creates the project with its tags, then its tasks and subtasks', async () => {
		const prisma = setup(projectTemplate);
		vi.mocked(prisma.project.create).mockResolvedValue(asRow({ id: 'p1' }));
		vi.mocked(prisma.task.create)
			.mockResolvedValueOnce(asRow({ id: 't1' }))
			.mockResolvedValueOnce(asRow({ id: 't2' }))
			.mockResolvedValueOnce(asRow({ id: 't3' }));
		const result = await instantiateTemplate(prisma, TEST_USER_ID, ID, { title: 'Q4 launch' });
		expect(result).toEqual({ projectId: 'p1', taskIds: ['t1', 't2', 't3'] });
		expect(vi.mocked(prisma.project.create).mock.calls[0]?.[0]?.data).toMatchObject({ description: 'Plan it', ownerId: TEST_USER_ID, tags: { create: [{ tagId: TAG_ID }] }, title: 'Q4 launch' });
		expect(taskDataOf(prisma).map(data => [data?.title, data?.parentId, data?.projectId])).toEqual([
			['Kickoff', null, 'p1'],
			['Ship', null, 'p1'],
			['QA', 't2', 'p1'],
		]);
	});

	it('requires a start date when the template has offsets', async () => {
		const prisma = setup();
		expect(await rejection(instantiateTemplate(prisma, TEST_USER_ID, ID, {}))).toMatchObject({ details: [{ code: 'start_date_required', field: 'startDate' }], status: 422 });
		expect(prisma.task.create).not.toHaveBeenCalled();
	});

	it('rejects a projectId for project templates and references that are not the owner’s', async () => {
		expect(await rejection(instantiateTemplate(setup(projectTemplate), TEST_USER_ID, ID, { projectId: REF_ID }))).toMatchObject({
			details: [{ code: 'not_applicable', field: 'projectId' }],
			status: 422,
		});
		const noProject = setup();
		vi.mocked(noProject.project.findFirst).mockResolvedValue(null);
		expect(await rejection(instantiateTemplate(noProject, TEST_USER_ID, ID, { projectId: REF_ID, startDate: START }))).toMatchObject({ details: [{ code: 'not_found', field: 'projectId' }] });
		const noGoal = setup();
		vi.mocked(noGoal.goal.findFirst).mockResolvedValue(null);
		expect(await rejection(instantiateTemplate(noGoal, TEST_USER_ID, ID, { goalId: REF_ID, startDate: START }))).toMatchObject({ details: [{ code: 'not_found', field: 'goalId' }] });
		expect(noGoal.task.create).not.toHaveBeenCalled();
	});

	it('throws 404 for another owner', async () => {
		expect(await rejection(instantiateTemplate(setup(null), OTHER_USER_ID, ID, {}))).toMatchObject({ code: 'not_found', status: 404 });
	});
});
