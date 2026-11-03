import { FileText } from 'lucide-react';
import { Pagination } from '~/components/ui/data-display/pagination/pagination';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { ListEmpty } from '../../shared/list-table';
import type { NoteSummary } from '../api';
import { NoteCard } from './note-card';

type Layout = 'grid' | 'list';

/** Placeholder cards with the shape of the real ones, so the list never shows empty while it loads. */
export function NoteListSkeleton({ layout }: { layout: Layout }) {
	return (
		<Skeleton className={layout === 'grid' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'gap-3'}>
			{[0, 1, 2, 3, 4, 5].map(key => (
				<div className='flex items-start gap-4 rounded-2xl border border-border p-4' key={key}>
					<Skeleton.Item className='size-12 shrink-0 rounded-xl' />
					<div className='flex flex-1 flex-col gap-2'>
						<Skeleton.Item className='h-4 w-2/3' />
						<Skeleton.Item className='h-3 w-full' />
						<div className='flex gap-2 pt-1'>
							<Skeleton.Item className='h-5 w-14 rounded-md' />
							<Skeleton.Item className='h-5 w-16 rounded-md' />
						</div>
					</div>
				</div>
			))}
		</Skeleton>
	);
}

interface NoteListProps {
	error: boolean;
	/** Some filter is on: the empty state says so instead of inviting to write the first note. */
	filtered: boolean;
	isLoading: boolean;
	layout: Layout;
	notes: NoteSummary[];
	onCopyLink: (note: NoteSummary) => void;
	onDelete: (note: NoteSummary) => void;
	onOpen: (note: NoteSummary) => void;
	onPageChange: (page: number) => void;
	onRetry: () => void;
	page: number;
	pageCount: number;
	pageSize: number;
	projectTitles: ReadonlyMap<string, string>;
	selectedId: string;
	total: number;
}

/** The notes of one page as cards (a column next to the editor, or a grid), with its pagination. */
export function NoteList({
	error,
	filtered,
	isLoading,
	layout,
	notes,
	onCopyLink,
	onDelete,
	onOpen,
	onPageChange,
	onRetry,
	page,
	pageCount,
	pageSize,
	projectTitles,
	selectedId,
	total,
}: NoteListProps) {
	const t = useTranslate();

	return (
		<div className='flex min-h-0 flex-1 flex-col gap-3'>
			<div className='min-h-0 flex-1 overflow-y-auto pr-1'>
				{isLoading ? (
					<NoteListSkeleton layout={layout} />
				) : error || notes.length === 0 ? (
					<ListEmpty
						description={filtered ? undefined : t('notes.empty.description')}
						error={error}
						errorTitle={t('notes.error.title')}
						icon={FileText}
						onRetry={onRetry}
						retryLabel={t('notes.error.retry')}
						title={filtered ? t('notes.empty.filtered') : t('notes.empty.title')}
					/>
				) : (
					<ul className={layout === 'grid' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-3'}>
						{notes.map(note => (
							<li key={note.id}>
								<NoteCard
									layout={layout}
									note={note}
									onCopyLink={onCopyLink}
									onDelete={onDelete}
									onOpen={onOpen}
									projectTitle={note.projectId ? projectTitles.get(note.projectId) : undefined}
									selected={note.id === selectedId}
								/>
							</li>
						))}
					</ul>
				)}
			</div>
			{!isLoading && !error && pageCount > 1 && (
				<Pagination className='mx-auto shrink-0' onPageChange={onPageChange} page={page} pageCount={pageCount} pageSize={pageSize} showEdges={false} showSummary={false} total={total} />
			)}
		</div>
	);
}
