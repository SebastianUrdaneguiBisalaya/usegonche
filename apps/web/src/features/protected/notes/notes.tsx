import { useHotkeys } from '@usehotkeys/react';
import { FileText, LayoutGrid, List, Plus, Trash2 } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Page } from '~/components/ui/layout/page/page';
import { ConfirmDialog } from '~/components/ui/overlays-feedback/confirm-dialog/confirm-dialog';
import { Drawer } from '~/components/ui/overlays-feedback/drawer/drawer';
import { useMediaQuery } from '~/hooks/use-media-query';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { ListSearch } from '../shared/list-search';
import { PAGE_SIZE } from '../shared/paged';
import { useProjectOptions } from '../shared/projects';
import { listStyles } from '../shared/styles';
import { useTagOptions } from '../shared/tags';
import { useDeleteNote, useNotes, useNotesSearch } from './api';
import { NewNoteModal } from './components/new-note-modal';
import { NoteEditor } from './components/note-editor';
import { NoteFilters } from './components/note-filters';
import { NoteList, NoteSearchList } from './components/note-list';
import { type NoteView, noteParsers, noteViews } from './search-params';

const viewIcons = { grid: LayoutGrid, list: List } as const;

interface Target {
	id: string;
	title: string;
}

export default function NotesRoute() {
	const t = useTranslate();
	const [params, setParams] = useQueryStates(noteParsers, { clearOnDefault: true });
	const page = Math.max(1, params.page);
	const searching = params.q.length > 0;
	const wide = useMediaQuery('(min-width: 1024px)', true);
	const inline = wide && params.view === 'list';
	const filtered = params.project !== '' || params.tag !== '' || params.task !== '';

	const list = useNotes({ page, project: params.project, tag: params.tag, task: params.task }, !searching);
	const search = useNotesSearch(params.q, page);
	const projects = useProjectOptions();
	const tags = useTagOptions();
	const projectTitles = useMemo(() => new Map((projects.data ?? []).map(project => [project.id, project.title])), [projects.data]);
	const projectOptions = useMemo(() => (projects.data ?? []).map(project => ({ id: project.id, name: project.title })), [projects.data]);
	const tagOptions = useMemo(() => (tags.data ?? []).map(tag => ({ id: tag.id, name: tag.name })), [tags.data]);

	const [creating, setCreating] = useState(false);
	const [deleting, setDeleting] = useState<Target | undefined>(undefined);
	const remove = useDeleteNote();

	// Leaving a note with an unsaved draft (another note, closing, a new one) asks first.
	const [dirty, setDirty] = useState(false);
	const [pendingLeave, setPendingLeave] = useState<(() => void) | undefined>(undefined);
	const guard = useCallback(
		(action: () => void) => {
			if (dirty) setPendingLeave(() => action);
			else action();
		},
		[dirty]
	);
	const openNote = useCallback((id: string) => guard(() => void setParams({ note: id })), [guard, setParams]);
	const closeNote = useCallback(() => guard(() => void setParams({ note: '' })), [guard, setParams]);

	const copyLink = useCallback(
		async (id: string) => {
			try {
				await navigator.clipboard.writeText(`${window.location.origin}/notes?note=${id}`);
				toast.success(t('notes.toast.linkCopied'));
			} catch {
				toast.error(t('errors.generic'));
			}
		},
		[t]
	);

	useHotkeys('n', () => guard(() => setCreating(true)), { group: 'notes', label: t('notes.new') });

	const active = searching ? search : list;
	const meta = active.data?.meta;
	const isLoading = active.isPending || (active.isPlaceholderData && active.isFetching && (active.data?.data.length ?? 0) === 0);
	const clearFilters = () => void setParams({ page: 1, project: '', tag: '', task: '' });

	const results = searching ? (
		<NoteSearchList
			hits={search.data?.data}
			isError={search.isError}
			isLoading={search.isPending}
			layout={params.view}
			onOpen={openNote}
			onRetry={() => void search.refetch()}
			selectedId={params.note}
		/>
	) : (
		<NoteList
			error={list.isError}
			filtered={filtered}
			isLoading={isLoading}
			layout={params.view}
			notes={list.data?.data ?? []}
			onCopyLink={note => void copyLink(note.id)}
			onDelete={note => setDeleting({ id: note.id, title: note.title })}
			onOpen={note => openNote(note.id)}
			onPageChange={next => void setParams({ page: next })}
			onRetry={() => void list.refetch()}
			page={meta?.page ?? page}
			pageCount={meta?.pageCount ?? 1}
			pageSize={PAGE_SIZE}
			projectTitles={projectTitles}
			selectedId={params.note}
			total={meta?.total ?? 0}
		/>
	);

	const editor = params.note ? (
		<NoteEditor noteId={params.note} onBack={inline ? undefined : closeNote} onDelete={note => setDeleting({ id: note.id, title: note.title })} onDirtyChange={setDirty} />
	) : null;

	return (
		<Page.Root className='min-h-0 flex-1' size='full'>
			<Page.Header>
				<div>
					<Page.Title>{t('notes.title')}</Page.Title>
					<Page.Description>{t('notes.subtitle')}</Page.Description>
				</div>
				<Page.Actions className='w-full sm:w-auto'>
					<ListSearch
						clearLabel={t('notes.search.clear')}
						label={t('notes.search.label')}
						onChange={q => void setParams({ page: 1, q })}
						placeholder={t('notes.search.placeholder')}
						value={params.q}
					/>
					<Button className={listStyles.pillTrigger} onClick={() => guard(() => setCreating(true))} variant='secondary'>
						<Button.Icon icon={Plus} />
						<Button.Text>{t('notes.new')}</Button.Text>
					</Button>
				</Page.Actions>
			</Page.Header>
			<Page.Body className='min-h-0 flex-1 gap-4'>
				<div className='flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4'>
					<NoteFilters
						count={list.data?.meta.total}
						filtered={filtered}
						onClear={clearFilters}
						onProjectChange={project => void setParams({ page: 1, project, q: '' })}
						onTagChange={tag => void setParams({ page: 1, q: '', tag })}
						onTaskChange={task => void setParams({ page: 1, q: '', task })}
						project={params.project}
						projects={projectOptions}
						tag={params.tag}
						tags={tagOptions}
						task={params.task}
					/>
					<div aria-label={t('notes.views.label')} className='flex items-center gap-1 rounded-full border border-border bg-foreground/[0.03] p-1' role='group'>
						{noteViews.map((view: NoteView) => (
							<button
								aria-label={t(`notes.views.${view}`)}
								aria-pressed={params.view === view}
								className={`flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors ${
									params.view === view ? 'bg-foreground/[0.1] text-foreground' : 'text-muted-foreground hover:text-foreground'
								}`}
								key={view}
								onClick={() => void setParams({ view })}
								title={t(`notes.views.${view}`)}
								type='button'
							>
								<Icon aria-hidden icon={viewIcons[view]} size='md' />
							</button>
						))}
					</div>
				</div>
				{inline ? (
					<div className='grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]'>
						<div className='flex min-h-0 flex-col'>{results}</div>
						<section aria-label={t('notes.editor.panel')} className={`${listStyles.card} flex min-h-0 flex-col overflow-hidden`}>
							{editor ?? (
								<div className='flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center'>
									<Icon aria-hidden className='text-muted-foreground' icon={FileText} size='xl' />
									<p className='text-sm font-medium'>{t('notes.editor.placeholderEmpty')}</p>
									<p className='text-xs text-muted-foreground'>{t('notes.editor.placeholderEmptyHint')}</p>
								</div>
							)}
						</section>
					</div>
				) : (
					<div className='flex min-h-0 flex-1 flex-col'>{results}</div>
				)}
			</Page.Body>

			{!inline && (
				<Drawer.Root onOpenChange={open => !open && closeNote()} open={params.note !== ''}>
					<Drawer.Content className='sm:max-w-3xl'>
						<h2 className='sr-only'>{t('notes.editor.panel')}</h2>
						{editor}
					</Drawer.Content>
				</Drawer.Root>
			)}

			<NewNoteModal
				links={{ projectId: params.project || undefined, taskIds: params.task ? [params.task] : undefined }}
				onCreated={note => void setParams({ note: note.id })}
				onOpenChange={setCreating}
				open={creating}
			/>

			<ConfirmDialog.Root
				lang={{ cancel: t('notes.delete.cancel'), confirm: t('notes.delete.confirm') }}
				onConfirm={async () => {
					if (!deleting) return;
					try {
						await remove.mutateAsync(deleting.id);
					} catch (error) {
						toast.error(getApiErrorMessage(error));
						return;
					}
					toast.success(t('notes.toast.deleted'));
					if (deleting.id === params.note) {
						setDirty(false);
						void setParams({ note: '' });
					}
					setDeleting(undefined);
				}}
				onOpenChange={open => !open && setDeleting(undefined)}
				open={deleting !== undefined}
				variant='destructive'
			>
				<ConfirmDialog.Content>
					<ConfirmDialog.Icon icon={Trash2} />
					<ConfirmDialog.Title>{t('notes.delete.title')}</ConfirmDialog.Title>
					<ConfirmDialog.Description>{t('notes.delete.description', { title: deleting?.title ?? '' })}</ConfirmDialog.Description>
					<ConfirmDialog.Footer>
						<ConfirmDialog.Cancel />
						<ConfirmDialog.Confirm />
					</ConfirmDialog.Footer>
				</ConfirmDialog.Content>
			</ConfirmDialog.Root>

			<ConfirmDialog.Root
				lang={{ cancel: t('notes.discard.cancel'), confirm: t('notes.discard.confirm') }}
				onConfirm={() => {
					pendingLeave?.();
					setDirty(false);
					setPendingLeave(undefined);
				}}
				onOpenChange={open => !open && setPendingLeave(undefined)}
				open={pendingLeave !== undefined}
				variant='destructive'
			>
				<ConfirmDialog.Content>
					<ConfirmDialog.Title>{t('notes.discard.title')}</ConfirmDialog.Title>
					<ConfirmDialog.Description>{t('notes.discard.description')}</ConfirmDialog.Description>
					<ConfirmDialog.Footer>
						<ConfirmDialog.Cancel />
						<ConfirmDialog.Confirm />
					</ConfirmDialog.Footer>
				</ConfirmDialog.Content>
			</ConfirmDialog.Root>
		</Page.Root>
	);
}
