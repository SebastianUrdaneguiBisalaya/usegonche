import { Archive, RotateCcw, X } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Progress } from '~/components/ui/data-display/progress/progress';
import { Tabs } from '~/components/ui/data-display/tabs/tabs';
import { Form } from '~/components/ui/forms-inputs/form/form';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Drawer } from '~/components/ui/overlays-feedback/drawer/drawer';
import { useLanguage } from '~/hooks/use-language';
import { useRetained } from '~/hooks/use-retained';
import { useTranslate } from '~/hooks/use-translate';
import { diffPayload } from '~/utils/diff-payload';
import { apiDateOnly } from '../../shared/dates';
import { DrawerSection } from '../../shared/drawer-section';
import { StatusBadge } from '../../shared/status-pill';
import { type Goal, useGoalProjects, useSetGoalArchived, useUpdateGoal } from '../api';
import { displayStatus, goalIcon, statusLook } from '../display';
import { createGoalFormSchema, type GoalFormValues } from '../schemas';
import { GoalFields } from './goal-fields';

interface GoalDrawerProps {
	goal: Goal | undefined;
	/** Called with the saved goal, so the drawer keeps showing it even if it no longer belongs to the listed tab. */
	onChange: (goal: Goal) => void;
	onClose: () => void;
}

const toFormValues = (goal: Goal): GoalFormValues => ({
	description: goal.description ?? '',
	status: goal.status,
	targetDate: apiDateOnly(goal.targetDate),
	title: goal.title,
});

function Body({ goal, onChange, onClose }: Omit<GoalDrawerProps, 'goal'> & { goal: Goal }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const update = useUpdateGoal();
	const setArchived = useSetGoalArchived();
	const schema = useMemo(() => createGoalFormSchema(t), [t]);
	const projects = useGoalProjects(goal.id, true);
	const { done, total } = goal.taskCounts;
	const status = displayStatus(goal);
	const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }), [locale]);

	const toggleArchived = () =>
		setArchived.mutate(
			{ archived: !goal.archivedAt, id: goal.id },
			{
				onSuccess: next => {
					onChange(next);
					toast.success(next.archivedAt ? t('goals.toast.archived') : t('goals.toast.restored'));
				},
			}
		);

	return (
		<>
			<Drawer.Header className='items-start'>
				<Layout.HStack className='min-w-0' gap='md'>
					<span aria-hidden className='flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-foreground/[0.06] text-muted-foreground'>
						<Icon icon={goalIcon(goal.id)} size='lg' />
					</span>
					<Layout.Stack className='min-w-0' gap='xs'>
						<Drawer.Title className='truncate'>{goal.title}</Drawer.Title>
						<Drawer.Description>{t('goals.drawer.created', { date: dateFormat.format(new Date(goal.createdAt)) })}</Drawer.Description>
					</Layout.Stack>
				</Layout.HStack>
				<Drawer.Close>
					<Button aria-label={t('goals.drawer.close')} className='size-9 shrink-0 rounded-full p-0' onClick={onClose} size='icon' variant='ghost'>
						<Button.Icon icon={X} />
					</Button>
				</Drawer.Close>
			</Drawer.Header>
			<Drawer.Body className='flex flex-col gap-5'>
				<Layout.HStack gap='md' wrap>
					<StatusBadge look={statusLook(status, t(`goals.status.${status}`))} />
					<Progress
						aria-label={t('goals.drawer.progress', { done, total })}
						className='w-48'
						title={t('goals.drawer.progress', { done, total })}
						value={total === 0 ? 0 : Math.round((done / total) * 100)}
					>
						<Progress.Indicator className='h-1.5' />
						<Progress.Label />
					</Progress>
				</Layout.HStack>
				<Tabs defaultValue='details'>
					<Tabs.List aria-label={t('goals.drawer.tabsLabel')} className='gap-1'>
						<Tabs.Trigger value='details'>
							<Tabs.TriggerTitle>{t('goals.drawer.details')}</Tabs.TriggerTitle>
						</Tabs.Trigger>
						<Tabs.Trigger value='projects'>
							<Tabs.TriggerTitle>{t('goals.drawer.projects')}</Tabs.TriggerTitle>
						</Tabs.Trigger>
					</Tabs.List>
					<Tabs.Content className='pt-5' value='details'>
						<Form
							defaultValues={toFormValues(goal)}
							mode='onSubmit'
							onSubmit={async values => {
								// Only what changed is sent; nothing changed, nothing requested.
								const changed = diffPayload<GoalFormValues>(toFormValues(goal), values);
								if (Object.keys(changed).length === 0) return;
								const { description, targetDate, ...rest } = changed;
								const next = await update.mutateAsync({
									changes: { ...rest, ...(description !== undefined && { description: description || null }), ...(targetDate !== undefined && { targetDate: targetDate || null }) },
									id: goal.id,
								});
								onChange(next);
								toast.success(t('goals.toast.saved'));
							}}
							schema={schema}
							values={toFormValues(goal)}
						>
							<Layout.Stack gap='lg'>
								<GoalFields withStatus />
								<Layout.HStack gap='sm' justify='between'>
									<Button className='rounded-full' loading={setArchived.isPending} onClick={toggleArchived} type='button' variant='secondary'>
										<Button.Icon icon={goal.archivedAt ? RotateCcw : Archive} />
										<Button.Text>{goal.archivedAt ? t('goals.actions.restore') : t('goals.actions.archive')}</Button.Text>
									</Button>
									<Form.Submit className='rounded-full'>{t('goals.form.save')}</Form.Submit>
								</Layout.HStack>
							</Layout.Stack>
						</Form>
					</Tabs.Content>
					<Tabs.Content className='pt-5' value='projects'>
						<DrawerSection
							empty={t('goals.drawer.projectsEmpty')}
							error={projects.isError}
							errorLabel={t('goals.drawer.loadError')}
							isLoading={projects.isPending}
							items={projects.data}
							onRetry={() => void projects.refetch()}
							render={project => (
								<>
									<span className='min-w-0 truncate'>{project.title}</span>
									<span className='shrink-0 text-xs text-muted-foreground'>{t(`projects.status.${project.status}`)}</span>
								</>
							)}
							retryLabel={t('goals.drawer.retry')}
						/>
					</Tabs.Content>
				</Tabs>
			</Drawer.Body>
		</>
	);
}

/** Detail of a goal: status and progress, an edit form (`PATCH /goals/:id`), archive / restore, and its projects. */
export function GoalDrawer({ goal, onChange, onClose }: GoalDrawerProps) {
	// Keeps the last goal while the drawer slides out, so it does not go blank mid-animation.
	const shown = useRetained(goal);

	return (
		<Drawer.Root onOpenChange={open => !open && onClose()} open={goal !== undefined}>
			<Drawer.Content className='sm:max-w-xl'>{shown && <Body goal={shown} key={shown.id} onChange={onChange} onClose={onClose} />}</Drawer.Content>
		</Drawer.Root>
	);
}
