import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { TourGuide, type TourGuideConfig, type TourGuideStep } from '~/components/ui/navigation/tour-guide/tour-guide';
import { OnboardingTimeline } from '~/components/ui/views/onboarding-timeline/onboarding-timeline';
import { useTranslate } from '~/hooks/use-translate';
import { settingsKey, type UpdateSettingsBody, type UserSettings, useUpdateSettings, useUserSettings } from '../settings/api';
import { type GettingStartedStep, gettingStartedKey, gettingStartedSteps, useGettingStarted } from './api';
import { tourTarget } from './tour-target';

/** Where each checklist step is done. */
const stepPath: Record<GettingStartedStep, string> = { goal: '/goals', plan: '/', project: '/projects', tag: '/tags', task: '/tasks' };

/** The tour's sidebar stops, in the order things are set up (tags first, the day plan last), then the rest of the Flow Cycle. */
const tourStops = ['tags', 'goals', 'projects', 'tasks', 'today', 'inbox', 'calendar', 'notes', 'reflect'] as const;

const OPEN_STORAGE_KEY = 'usegonche:getting-started-open';

/** Marks the guide's one-way flags: the cache first (the widget goes away at once), then the API. */
function useCompleteGuide() {
	const queryClient = useQueryClient();
	const update = useUpdateSettings();
	return (changes: Pick<UpdateSettingsBody, 'gettingStartedCompleted' | 'tourCompleted'>) => {
		const now = new Date().toISOString();
		queryClient.setQueryData<UserSettings>(
			settingsKey,
			current =>
				current && {
					...current,
					...(changes.tourCompleted ? { tourCompletedAt: now } : {}),
					...(changes.gettingStartedCompleted ? { gettingStartedCompletedAt: now } : {}),
				}
		);
		update.mutate(changes);
	};
}

/** First-run product tour over the sidebar. Finishing it or closing it (✕, Esc, a click outside) marks it as seen for good. */
function ProductTour() {
	const t = useTranslate();
	const complete = useCompleteGuide();
	const completeRef = useRef(complete);
	completeRef.current = complete;

	const steps = useMemo<TourGuideStep[]>(() => {
		// Below `md` the sidebar is an off-canvas drawer: the stops show centered instead of pointing at a hidden link.
		const sidebarVisible = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
		const stop = (id: (typeof tourStops)[number]): TourGuideStep => ({
			element: sidebarVisible ? tourTarget(id) : undefined,
			popover: { align: 'start', description: t(`gettingStarted.tour.${id}.description`), side: 'right', title: t(`gettingStarted.tour.${id}.title`) },
		});
		return [
			{ popover: { description: t('gettingStarted.tour.welcome.description'), title: t('gettingStarted.tour.welcome.title') } },
			...tourStops.map(stop),
			{ popover: { description: t('gettingStarted.tour.finish.description'), title: t('gettingStarted.tour.finish.title') } },
		];
	}, [t]);

	const config = useMemo<Omit<TourGuideConfig, 'steps'>>(
		() => ({
			doneBtnText: t('gettingStarted.tour.done'),
			nextBtnText: t('gettingStarted.tour.next'),
			// Only a close by the user lands here (`destroy()` on unmount skips it), so React remounting the tour never marks it as seen.
			onDestroyStarted: (_element, _step, { driver }) => {
				driver.destroy();
				completeRef.current({ tourCompleted: true });
			},
			prevBtnText: t('gettingStarted.tour.previous'),
			progressText: t('gettingStarted.tour.progress', { current: '{{current}}', total: '{{total}}' }),
		}),
		[t]
	);

	return <TourGuide.Root autoStart config={config} steps={steps} />;
}

function readOpen(): boolean {
	try {
		return window.localStorage.getItem(OPEN_STORAGE_KEY) !== 'false';
	} catch {
		return true;
	}
}

/**
 * Floating getting-started checklist (bottom right): tag → goal → project → task → plan for today. Each step checks itself off from the
 * user's data; once all are done (or the guide is skipped) it is completed for good.
 */
function Checklist() {
	const t = useTranslate();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const complete = useCompleteGuide();
	const progress = useGettingStarted(true);
	const [open, setOpen] = useState(readOpen);

	// Anything the user creates (a tag, a goal, a task, the plan...) may finish a step: refetch after every successful change.
	useEffect(
		() =>
			queryClient.getMutationCache().subscribe(event => {
				if (event.type === 'updated' && event.action.type === 'success') void queryClient.invalidateQueries({ queryKey: gettingStartedKey });
			}),
		[queryClient]
	);

	const data = progress.data;
	const done = data ? gettingStartedSteps.filter(step => data[step]).length : 0;
	// The timeline is ordered: the current step is the first one not done yet.
	const current = data ? gettingStartedSteps.findIndex(step => !data[step]) : 0;
	const finished = data !== undefined && current === -1;

	const completeRef = useRef(complete);
	completeRef.current = complete;
	useEffect(() => {
		if (!finished) return;
		toast.success(t('gettingStarted.checklist.completed'));
		completeRef.current({ gettingStartedCompleted: true });
	}, [finished, t]);

	const changeOpen = (next: boolean) => {
		setOpen(next);
		try {
			window.localStorage.setItem(OPEN_STORAGE_KEY, String(next));
		} catch {
			// Only a convenience: without storage it just opens again on the next visit.
		}
	};

	if (!data || finished) return null;

	return (
		<OnboardingTimeline.Root onOpenChange={changeOpen} open={open} totalSteps={gettingStartedSteps.length} value={current}>
			<OnboardingTimeline.Trigger aria-label={t('gettingStarted.checklist.open')} />
			<OnboardingTimeline.Panel>
				<OnboardingTimeline.Header>
					<div className='flex flex-col gap-0.5'>
						<OnboardingTimeline.Title>{t('gettingStarted.checklist.title')}</OnboardingTimeline.Title>
						<OnboardingTimeline.Description>{t('gettingStarted.checklist.description', { done, total: gettingStartedSteps.length })}</OnboardingTimeline.Description>
					</div>
					<OnboardingTimeline.Close aria-label={t('gettingStarted.checklist.minimize')} />
				</OnboardingTimeline.Header>
				<OnboardingTimeline.Steps
					lang={{ active: t('gettingStarted.checklist.status.active'), completed: t('gettingStarted.checklist.status.completed'), upcoming: t('gettingStarted.checklist.status.upcoming') }}
				>
					{gettingStartedSteps.map((step, index) => (
						<OnboardingTimeline.Step description={t(`gettingStarted.checklist.steps.${step}.description`)} key={step} title={t(`gettingStarted.checklist.steps.${step}.title`)}>
							{index === current && (
								<Button className='h-8 rounded-full px-3 text-xs' onClick={() => void navigate(stepPath[step])} variant='secondary'>
									<Button.Text>{t(`gettingStarted.checklist.steps.${step}.action`)}</Button.Text>
									<Button.Icon icon={ArrowRight} />
								</Button>
							)}
						</OnboardingTimeline.Step>
					))}
				</OnboardingTimeline.Steps>
				<OnboardingTimeline.Footer className='flex justify-end'>
					<Button className='h-8 px-3 text-xs text-muted-foreground' onClick={() => complete({ gettingStartedCompleted: true })} variant='ghost'>
						<Button.Text>{t('gettingStarted.checklist.skip')}</Button.Text>
					</Button>
				</OnboardingTimeline.Footer>
			</OnboardingTimeline.Panel>
		</OnboardingTimeline.Root>
	);
}

/** First-run guide for new accounts: the product tour first, then the getting-started checklist. Neither shows again once completed. */
export function GettingStarted() {
	const { data: settings } = useUserSettings();
	if (!settings) return null;
	if (!settings.tourCompletedAt) return <ProductTour />;
	if (!settings.gettingStartedCompletedAt) return <Checklist />;
	return null;
}
