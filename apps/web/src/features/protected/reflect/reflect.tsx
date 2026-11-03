import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { ToggleGroup } from '~/components/ui/actions-controls/toggle-group/toggle-group';
import { DatePicker } from '~/components/ui/forms-inputs/date-picker/date-picker';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Page } from '~/components/ui/layout/page/page';
import { useDebouncedValue } from '~/hooks/use-debounced-value';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { fromDateOnly, toDateOnly } from '../shared/dates';
import { listStyles } from '../shared/styles';
import { useDateTime } from '../shared/use-datetime';
import { usePickerLang } from '../tasks/components/task-pills';
import { type Review, type ReviewKind, useCloseReview, useReview, useUpdateReview } from './api';
import { ActionsCard } from './components/actions-card';
import { DecisionsCard } from './components/decisions-card';
import { NextFocusCard } from './components/next-focus-card';
import { PeriodBar } from './components/period-bar';
import { ReflectionCard, type SaveStatus } from './components/reflection-card';
import { SummaryCard } from './components/summary-card';

const kinds = ['daily', 'weekly'] as const;
const AUTOSAVE_MS = 800;

/** The review of one period: the text is a draft saved automatically while the review is open; closing it locks everything. */
function Workspace({ review }: { review: Review }) {
	const t = useTranslate();
	const open = review.status === 'open';
	const update = useUpdateReview(review.id);
	const close = useCloseReview(review.id);
	const [reflection, setReflection] = useState(review.reflection ?? '');
	const [focus, setFocus] = useState(review.nextFocus ?? '');
	const savedReflection = useRef(review.reflection ?? '');
	const savedFocus = useRef(review.nextFocus ?? '');
	const [savedFocusState, setSavedFocusState] = useState(review.nextFocus ?? '');
	const debounced = useDebouncedValue(reflection, AUTOSAVE_MS);

	const fail = (error: unknown) => toast.error(getApiErrorMessage(error));

	// Autosave of the reflection: only when it differs from what the API has.
	// biome-ignore lint/correctness/useExhaustiveDependencies: `update` changes on every render; only the debounced text should trigger a save.
	useEffect(() => {
		if (!open || debounced === savedReflection.current) return;
		update.mutate({ reflection: debounced.trim() === '' ? null : debounced }, { onSuccess: () => void (savedReflection.current = debounced) });
	}, [debounced, open]);

	const status: SaveStatus = update.isError ? 'error' : update.isPending ? 'saving' : reflection !== savedReflection.current || debounced !== reflection ? 'unsaved' : 'saved';

	const text = () => ({ nextFocus: focus.trim() === '' ? null : focus.trim(), reflection: reflection.trim() === '' ? null : reflection });
	const saveFocus = () =>
		update.mutate(
			{ nextFocus: text().nextFocus },
			{
				onError: fail,
				onSuccess: () => {
					savedFocus.current = focus;
					setSavedFocusState(focus);
					toast.success(t('reflect.focus.saved'));
				},
			}
		);
	const saveDraft = () =>
		update.mutate(text(), {
			onError: fail,
			onSuccess: () => {
				savedReflection.current = reflection;
				savedFocus.current = focus;
				setSavedFocusState(focus);
				toast.success(t('reflect.actions.draftSaved'));
			},
		});

	return (
		<>
			<PeriodBar review={review} />
			<div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]'>
				<div className='flex flex-col gap-4'>
					<ReflectionCard markdown={reflection} onChange={setReflection} readOnly={!open} status={status} />
					<DecisionsCard review={review} />
					<NextFocusCard onChange={setFocus} onSave={saveFocus} pending={update.isPending} readOnly={!open} saved={savedFocusState} value={focus} />
				</div>
				<div className='flex flex-col gap-4'>
					<SummaryCard review={review} />
					<ActionsCard
						closed={!open}
						closing={close.isPending}
						onClose={() => close.mutate(text(), { onError: fail, onSuccess: () => toast.success(t('reflect.actions.closeDone')) })}
						onDraft={saveDraft}
						saving={update.isPending}
					/>
				</div>
			</div>
		</>
	);
}

export default function ReflectRoute() {
	const t = useTranslate();
	const { locale } = useLanguage();
	const pickerLang = usePickerLang();
	const { today } = useDateTime();
	const [kind, setKind] = useQueryState('kind', parseAsStringLiteral(kinds).withDefault('daily'));
	const [param, setParam] = useQueryState('date', parseAsString.withDefault(''));
	const date = param || today();
	const review = useReview(kind as ReviewKind, date);

	return (
		<Page.Root className='min-h-0 flex-1' size='full'>
			<Page.Header>
				<div>
					<Page.Title>{t('reflect.title')}</Page.Title>
					<Page.Description>{t('reflect.subtitle')}</Page.Description>
				</div>
				<Page.Actions className='w-full sm:w-auto'>
					<ToggleGroup className={`${listStyles.pillTrigger} flex gap-1 p-1`} onValueChange={next => next && void setKind(next as ReviewKind)} type='single' value={kind}>
						{kinds.map(value => (
							<ToggleGroup.Item className='rounded-full' key={value} value={value}>
								{t(`reflect.kind.${value}`)}
							</ToggleGroup.Item>
						))}
					</ToggleGroup>
					<DatePicker.Root lang={pickerLang} locale={locale} onChange={next => void setParam(next ? toDateOnly(next) : null)} value={fromDateOnly(date)}>
						<DatePicker.Trigger aria-label={t('reflect.date')} className={`${listStyles.pillTrigger} h-auto`} placeholder={t('reflect.date')} />
						<DatePicker.Content />
					</DatePicker.Root>
				</Page.Actions>
			</Page.Header>
			<Page.Body className='min-h-0 flex-1 gap-4'>
				{review.isPending ? (
					<Skeleton className='gap-4' label={t('reflect.title')}>
						<Skeleton.Item className='h-20 w-full rounded-2xl' />
						<Skeleton.Item className='h-64 w-full rounded-2xl' />
					</Skeleton>
				) : review.isError || !review.data ? (
					<div className='flex flex-col items-center gap-3 p-10 text-center'>
						<p className='text-sm text-muted-foreground'>{t('reflect.loadError')}</p>
						<Button onClick={() => void review.refetch()} variant='secondary'>
							<Button.Text>{t('reflect.retry')}</Button.Text>
						</Button>
					</div>
				) : (
					<Workspace key={review.data.id} review={review.data} />
				)}
			</Page.Body>
		</Page.Root>
	);
}
