import { Ellipsis, FolderKanban, Link2, Trash2 } from 'lucide-react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Dropdown } from '~/components/ui/overlays-feedback/dropdown/dropdown';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { formatRelative } from '../../shared/relative-time';
import { TagChip } from '../../shared/tag-chip';
import type { NoteSummary } from '../api';
import { noteIcon } from '../display';

const TAGS_SHOWN = 2;

interface NoteCardProps {
	note: NoteSummary;
	onCopyLink: (note: NoteSummary) => void;
	onDelete: (note: NoteSummary) => void;
	onOpen: (note: NoteSummary) => void;
	projectTitle: string | undefined;
	selected: boolean;
}

/** One note of the list: icon, title, the start of its text, its tags, project and last edit. The whole card opens the note; the menu has the rest. */
export function NoteCard({ note, onCopyLink, onDelete, onOpen, projectTitle, selected }: NoteCardProps) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const hidden = note.tags.length - TAGS_SHOWN;

	return (
		<article
			aria-current={selected ? 'true' : undefined}
			className={cn(
				'group relative flex gap-4 rounded-2xl border p-4 transition-colors',
				'items-start',
				selected ? 'border-border-strong bg-foreground/[0.08] shadow-sm' : 'border-border bg-foreground/[0.03] hover:bg-foreground/[0.05]'
			)}
		>
			<span aria-hidden className='flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-foreground/[0.06] text-muted-foreground'>
				<Icon icon={noteIcon(note.id)} size='lg' />
			</span>
			<div className='flex min-w-0 flex-1 flex-col gap-1.5'>
				<button
					className='cursor-pointer truncate pr-8 text-left text-base font-medium after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!'
					onClick={() => onOpen(note)}
					type='button'
				>
					{note.title}
				</button>
				<p className='truncate text-sm text-muted-foreground'>{note.excerpt || t('notes.card.noExcerpt')}</p>
				<div className='mt-1 flex flex-wrap items-center gap-2'>
					{note.tags.slice(0, TAGS_SHOWN).map(tag => (
						<TagChip color={tag.color} key={tag.id} name={tag.name} />
					))}
					{hidden > 0 && <span className='text-xs text-muted-foreground'>+{hidden}</span>}
					{projectTitle && (
						<span className='flex min-w-0 max-w-40 items-center gap-1 text-xs text-muted-foreground' title={t('notes.card.project')}>
							<Icon aria-hidden icon={FolderKanban} size='xs' />
							<span className='truncate'>{projectTitle}</span>
						</span>
					)}
					<span className='text-xs text-muted-foreground'>{formatRelative(note.updatedAt, locale)}</span>
				</div>
			</div>
			<div className='absolute top-3 right-3 z-10'>
				<Dropdown>
					<Dropdown.Trigger>
						<Button aria-label={t('notes.card.more', { title: note.title })} className='size-8 rounded-full p-0 text-muted-foreground' size='icon' variant='ghost'>
							<Button.Icon icon={Ellipsis} />
						</Button>
					</Dropdown.Trigger>
					<Dropdown.Content align='end'>
						<Dropdown.Item onSelect={() => onCopyLink(note)}>
							<Icon aria-hidden icon={Link2} size='sm' />
							{t('notes.actions.copyLink')}
						</Dropdown.Item>
						<Dropdown.Item onSelect={() => onDelete(note)} variant='destructive'>
							<Icon aria-hidden icon={Trash2} size='sm' />
							{t('notes.actions.delete')}
						</Dropdown.Item>
					</Dropdown.Content>
				</Dropdown>
			</div>
		</article>
	);
}
