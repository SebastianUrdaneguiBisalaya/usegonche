import { Archive, RotateCcw, X } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Progress } from '~/components/ui/data-display/progress/progress';
import { Tabs } from '~/components/ui/data-display/tabs/tabs';
import { Form } from '~/components/ui/forms-inputs/form/form';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Drawer } from '~/components/ui/overlays-feedback/drawer/drawer';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { formatRelative } from '../../shared/relative-time';
import { type Project, useProjectFiles, useProjectNotes, useProjectTasks, useSetArchived, useUpdateProject } from '../api';
import { displayStatus, projectIcon } from '../display';
import { createProjectFormSchema, type ProjectFormValues } from '../schemas';
import { ProjectFields } from './project-fields';
import { StatusPill } from './status-pill';

interface ProjectDrawerProps {
	/** Called with the saved project, so the drawer keeps showing it even if it no longer belongs to the listed tab. */
	onChange: (project: Project) => void;
	onClose: () => void;
	project: Project | null;
}

const toFormValues = (project: Project): ProjectFormValues => ({
	description: project.description ?? '',
	goalId: project.goalId ?? '',
	status: project.status,
	tagIds: project.tags.map(tag => tag.id),
	title: project.title,
});

const formatSize = (bytes: number): string => (bytes < 1024 ? `${bytes} B` : bytes < 1_048_576 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1_048_576).toFixed(1)} MB`);

interface SectionProps<T> {
	empty: string;
	error: boolean;
	isLoading: boolean;
	items: readonly T[] | undefined;
	onRetry: () => void;
	render: (item: T) => React.ReactNode;
}

/** One read-only list of the drawer (tasks, notes, files): skeleton while loading, an empty state, or a retry on error. */
function Section<T extends { id: string }>({ empty, error, isLoading, items, onRetry, render }: SectionProps<T>) {
	const t = useTranslate();
	if (isLoading) {
		return (
			<Skeleton className='gap-3'>
				{[0, 1, 2, 3].map(key => (
					<Skeleton.Item className='h-12 w-full rounded-xl' key={key} />
				))}
			</Skeleton>
		);
	}
	if (error) {
		return (
			<Layout.Stack align='center' className='py-10 text-center' gap='sm'>
				<Typography.Span className='text-sm text-muted-foreground'>{t('projects.drawer.loadError')}</Typography.Span>
				<Button onClick={onRetry} variant='secondary'>
					<Button.Text>{t('projects.drawer.retry')}</Button.Text>
				</Button>
			</Layout.Stack>
		);
	}
	if (!items || items.length === 0) return <Typography.Span className='block py-10 text-center text-sm text-muted-foreground'>{empty}</Typography.Span>;
	return (
		<ul className='flex flex-col gap-2'>
			{items.map(item => (
				<li className='flex items-center justify-between gap-3 rounded-xl border border-border bg-foreground/[0.03] px-4 py-3 text-sm' key={item.id}>
					{render(item)}
				</li>
			))}
		</ul>
	);
}

function Body({ onChange, onClose, project }: Omit<ProjectDrawerProps, 'project'> & { project: Project }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const update = useUpdateProject();
	const setArchived = useSetArchived();
	const schema = useMemo(() => createProjectFormSchema(t), [t]);
	const tasks = useProjectTasks(project.id, true);
	const notes = useProjectNotes(project.id, true);
	const files = useProjectFiles(project.id, true);
	const { done, total } = project.taskCounts;
	const status = displayStatus(project);
	const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }), [locale]);

	const toggleArchived = () =>
		setArchived.mutate(
			{ archived: !project.archivedAt, id: project.id },
			{
				onSuccess: next => {
					onChange(next);
					toast.success(next.archivedAt ? t('projects.toast.archived') : t('projects.toast.restored'));
				},
			}
		);

	return (
		<>
			<Drawer.Header className='items-start'>
				<Layout.HStack className='min-w-0' gap='md'>
					<span aria-hidden className='flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-foreground/[0.06] text-muted-foreground'>
						<Icon icon={projectIcon(project.id)} size='lg' />
					</span>
					<Layout.Stack className='min-w-0' gap='xs'>
						<Drawer.Title className='truncate'>{project.title}</Drawer.Title>
						<Drawer.Description>{t('projects.drawer.created', { date: dateFormat.format(new Date(project.createdAt)) })}</Drawer.Description>
					</Layout.Stack>
				</Layout.HStack>
				<Drawer.Close>
					<Button aria-label={t('projects.drawer.close')} className={'size-9 shrink-0 rounded-full p-0'} onClick={onClose} size='icon' variant='ghost'>
						<Button.Icon icon={X} />
					</Button>
				</Drawer.Close>
			</Drawer.Header>
			<Drawer.Body className='flex flex-col gap-5'>
				<Layout.HStack gap='md' wrap>
					<StatusPill status={status} />
					<Progress
						aria-label={t('projects.drawer.progress', { done, total })}
						className='w-48'
						title={t('projects.drawer.progress', { done, total })}
						value={total === 0 ? 0 : Math.round((done / total) * 100)}
					>
						<Progress.Indicator className='h-1.5' />
						<Progress.Label />
					</Progress>
				</Layout.HStack>
				<Tabs defaultValue='details'>
					<Tabs.List aria-label={t('projects.drawer.tabsLabel')} className='gap-1'>
						<Tabs.Trigger value='details'>
							<Tabs.TriggerTitle>{t('projects.drawer.details')}</Tabs.TriggerTitle>
						</Tabs.Trigger>
						<Tabs.Trigger value='tasks'>
							<Tabs.TriggerTitle>{t('projects.drawer.tasks')}</Tabs.TriggerTitle>
						</Tabs.Trigger>
						<Tabs.Trigger value='notes'>
							<Tabs.TriggerTitle>{t('projects.drawer.notes')}</Tabs.TriggerTitle>
						</Tabs.Trigger>
						<Tabs.Trigger value='files'>
							<Tabs.TriggerTitle>{t('projects.drawer.files')}</Tabs.TriggerTitle>
						</Tabs.Trigger>
					</Tabs.List>
					<Tabs.Content className='pt-5' value='details'>
						<Form
							defaultValues={toFormValues(project)}
							mode='onSubmit'
							onSubmit={async values => {
								const next = await update.mutateAsync({
									changes: { description: values.description || null, goalId: values.goalId || null, status: values.status, tagIds: values.tagIds, title: values.title },
									id: project.id,
								});
								onChange(next);
								toast.success(t('projects.toast.saved'));
							}}
							schema={schema}
							values={toFormValues(project)}
						>
							<Layout.Stack gap='lg'>
								<ProjectFields withStatus />
								<Layout.HStack gap='sm' justify='between'>
									<Button className='rounded-full' loading={setArchived.isPending} onClick={toggleArchived} type='button' variant='secondary'>
										<Button.Icon icon={project.archivedAt ? RotateCcw : Archive} />
										<Button.Text>{project.archivedAt ? t('projects.actions.restore') : t('projects.actions.archive')}</Button.Text>
									</Button>
									<Form.Submit className='rounded-full'>{t('projects.form.save')}</Form.Submit>
								</Layout.HStack>
							</Layout.Stack>
						</Form>
					</Tabs.Content>
					<Tabs.Content className='pt-5' value='tasks'>
						<Section
							empty={t('projects.drawer.tasksEmpty')}
							error={tasks.isError}
							isLoading={tasks.isPending}
							items={tasks.data}
							onRetry={() => void tasks.refetch()}
							render={task => (
								<>
									<span className='min-w-0 truncate'>{task.title}</span>
									<span className='shrink-0 text-xs text-muted-foreground'>{t(`projects.drawer.taskStatus.${task.status}`)}</span>
								</>
							)}
						/>
					</Tabs.Content>
					<Tabs.Content className='pt-5' value='notes'>
						<Section
							empty={t('projects.drawer.notesEmpty')}
							error={notes.isError}
							isLoading={notes.isPending}
							items={notes.data}
							onRetry={() => void notes.refetch()}
							render={note => (
								<>
									<span className='min-w-0 truncate'>{note.title}</span>
									<span className='shrink-0 text-xs text-muted-foreground'>{formatRelative(note.updatedAt, locale)}</span>
								</>
							)}
						/>
					</Tabs.Content>
					<Tabs.Content className='pt-5' value='files'>
						<Section
							empty={t('projects.drawer.filesEmpty')}
							error={files.isError}
							isLoading={files.isPending}
							items={files.data}
							onRetry={() => void files.refetch()}
							render={file => (
								<>
									<span className='min-w-0 truncate'>{file.name}</span>
									<span className='shrink-0 text-xs text-muted-foreground'>{formatSize(file.sizeBytes)}</span>
								</>
							)}
						/>
					</Tabs.Content>
				</Tabs>
			</Drawer.Body>
		</>
	);
}

/** Detail of a project: status and progress, an edit form (`PATCH /projects/:id`), archive / restore, and its tasks, notes and files. */
export function ProjectDrawer({ onChange, onClose, project }: ProjectDrawerProps) {
	// Keeps the last project while the drawer slides out, so it does not go blank mid-animation.
	const last = useRef<Project | null>(null);
	if (project) last.current = project;
	const shown = project ?? last.current;

	return (
		<Drawer.Root onOpenChange={open => !open && onClose()} open={project !== null}>
			<Drawer.Content className='sm:max-w-xl'>{shown && <Body key={shown.id} onChange={onChange} onClose={onClose} project={shown} />}</Drawer.Content>
		</Drawer.Root>
	);
}
