import { useHotkeys } from '@usehotkeys/react';
import { ArrowLeft, Check, Copy, Link2, LoaderCircle, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { RichTextEditor, type RichTextEditorLang } from '~/components/ui/forms-inputs/rich-text-editor/rich-text-editor';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { formatRelative } from '../../shared/relative-time';
import { type Note, useNote, useUpdateNote } from '../api';
import { TITLE_MAX } from '../schemas';
import { AttachmentsCard } from './attachments-card';
import { type NoteLinks, NoteMeta } from './note-meta';
import { NoteReminder } from './note-reminder';
import { RevisionHistory } from './revision-history';

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

const linksOf = (note: Note): NoteLinks => ({ projectId: note.projectId, tagIds: note.tags.map(tag => tag.id), taskIds: note.taskIds });

interface NoteEditorProps {
	noteId: string;
	onBack?: () => void;
	onDelete: (note: Note) => void;
	/** Reports whether the draft differs from the saved note, so the page can ask before leaving it. */
	onDirtyChange: (dirty: boolean) => void;
}

/** The editor panel of one note: loads it and shows skeleton, error or the draft editor. */
export function NoteEditor({ noteId, onBack, onDelete, onDirtyChange }: NoteEditorProps) {
	const t = useTranslate();
	const note = useNote(noteId);
	const [version, setVersion] = useState(0);

	// A note that is not loaded has no draft to protect.
	useEffect(() => {
		if (!note.data) onDirtyChange(false);
	}, [note.data, onDirtyChange]);

	if (note.isPending) {
		return (
			<Skeleton className='gap-4 p-6' label={t('notes.editor.panel')}>
				<Skeleton.Item className='h-10 w-2/3' />
				<Skeleton.Item className='h-5 w-full' />
				<Skeleton.Item className='h-40 w-full rounded-xl' />
			</Skeleton>
		);
	}
	if (note.isError || !note.data) {
		return (
			<div className='flex flex-col items-center gap-3 p-10 text-center'>
				<p className='text-sm text-muted-foreground'>{t('notes.editor.loadError')}</p>
				<Button onClick={() => void note.refetch()} variant='secondary'>
					<Button.Text>{t('notes.editor.retry')}</Button.Text>
				</Button>
			</div>
		);
	}
	return <Draft key={`${note.data.id}:${version}`} note={note.data} onBack={onBack} onDelete={onDelete} onDirtyChange={onDirtyChange} onRestored={() => setVersion(value => value + 1)} />;
}

interface DraftProps extends Omit<NoteEditorProps, 'noteId'> {
	note: Note;
	onRestored: () => void;
}

/** Title, links and text are a draft until the explicit Save (no autosave); it starts from the note and stays until saved or discarded. */
function Draft({ note, onBack, onDelete, onDirtyChange, onRestored }: DraftProps) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const update = useUpdateNote();
	const [title, setTitle] = useState(note.title);
	const [body, setBody] = useState(note.body ?? '');
	const [links, setLinks] = useState<NoteLinks>(() => linksOf(note));
	const saved = linksOf(note);

	const dirty = title !== note.title || body !== (note.body ?? '') || links.projectId !== saved.projectId || !sameSet(links.tagIds, saved.tagIds) || !sameSet(links.taskIds, saved.taskIds);
	const canSave = dirty && title.trim() !== '' && !update.isPending;

	useEffect(() => {
		onDirtyChange(dirty);
		return () => onDirtyChange(false);
	}, [dirty, onDirtyChange]);

	const save = () => {
		if (!canSave) return;
		update.mutate(
			{ changes: { body: body === '' ? null : body, projectId: links.projectId, tagIds: links.tagIds, taskIds: links.taskIds, title: title.trim() }, id: note.id },
			{ onSuccess: () => toast.success(t('notes.toast.saved')) }
		);
	};

	const saveRef = useRef(save);
	saveRef.current = save;
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key.toLowerCase() !== 's' || !(event.metaKey || event.ctrlKey)) return;
			event.preventDefault();
			saveRef.current();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);
	useHotkeys('mod+s', () => saveRef.current(), { group: 'notes', ignoreInputs: false, label: t('notes.editor.saveShortcut') });

	const copy = async (text: string, message: string) => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(message);
		} catch {
			toast.error(t('errors.generic'));
		}
	};

	const lang = useMemo<Partial<RichTextEditorLang>>(
		() => ({
			bold: t('notes.editor.bold'),
			bulletList: t('notes.editor.bulletList'),
			checklist: t('notes.editor.checklist'),
			divider: t('notes.editor.divider'),
			heading1: t('notes.editor.heading1'),
			heading2: t('notes.editor.heading2'),
			heading3: t('notes.editor.heading3'),
			highlight: t('notes.editor.highlight'),
			italic: t('notes.editor.italic'),
			link: t('notes.editor.link'),
			linkUrlPrompt: t('notes.editor.linkPrompt'),
			numberedList: t('notes.editor.numberedList'),
			quote: t('notes.editor.quote'),
			redo: t('notes.editor.redo'),
			strikethrough: t('notes.editor.strikethrough'),
			underline: t('notes.editor.underline'),
			undo: t('notes.editor.undo'),
		}),
		[t]
	);

	const status = update.isPending ? 'saving' : update.isError ? 'error' : dirty ? 'unsaved' : 'saved';
	const iconButton = 'size-9 rounded-full p-0 text-muted-foreground hover:text-foreground';

	return (
		<div className='flex min-h-0 flex-1 flex-col'>
			<div className='flex items-center gap-2 px-5 pt-4 pb-2'>
				{onBack && (
					<Button className='-ml-2 text-muted-foreground' onClick={onBack} type='button' variant='ghost'>
						<Button.Icon icon={ArrowLeft} />
						<Button.Text>{t('notes.editor.back')}</Button.Text>
					</Button>
				)}
				<div className='ml-auto flex items-center gap-1'>
					<span aria-live='polite' className={cn('mr-2 flex items-center gap-1.5 text-xs', status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
						{status === 'saving' && <Icon className='animate-spin motion-reduce:animate-none' icon={LoaderCircle} size='xs' />}
						{status === 'saved' && <Icon className='text-success' icon={Check} size='xs' />}
						{status === 'unsaved' && <span aria-hidden className='size-1.5 rounded-full bg-current' />}
						{status === 'saved' ? `${t('notes.editor.status.saved')} · ${formatRelative(note.updatedAt, locale)}` : t(`notes.editor.status.${status}`)}
					</span>
					<Button
						aria-label={t('notes.editor.copyLink')}
						className={iconButton}
						onClick={() => void copy(`${window.location.origin}/notes?note=${note.id}`, t('notes.toast.linkCopied'))}
						size='icon'
						title={t('notes.editor.copyLink')}
						type='button'
						variant='ghost'
					>
						<Button.Icon icon={Link2} />
					</Button>
					<Button
						aria-label={t('notes.editor.copyMarkdown')}
						className={iconButton}
						onClick={() => void copy(body, t('notes.toast.markdownCopied'))}
						size='icon'
						title={t('notes.editor.copyMarkdown')}
						type='button'
						variant='ghost'
					>
						<Button.Icon icon={Copy} />
					</Button>
					<Button aria-label={t('notes.editor.delete')} className={iconButton} onClick={() => onDelete(note)} size='icon' title={t('notes.editor.delete')} type='button' variant='ghost'>
						<Button.Icon icon={Trash2} />
					</Button>
					<Button disabled={!canSave} loading={update.isPending} onClick={save} type='button'>
						<Button.Icon icon={Save} />
						<Button.Text>{t('notes.editor.save')}</Button.Text>
					</Button>
				</div>
			</div>
			<div className='flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-2 pb-5'>
				<input
					aria-label={t('notes.editor.titleLabel')}
					className='w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60'
					maxLength={TITLE_MAX}
					onChange={event => setTitle(event.target.value)}
					placeholder={t('notes.editor.titlePlaceholder')}
					value={title}
				/>
				<NoteMeta onChange={setLinks} value={links} />
				<RichTextEditor lang={lang} markdown={note.body ?? ''} onMarkdownChange={setBody} placeholder={t('notes.editor.placeholder')}>
					<RichTextEditor.Toolbar className='rounded-t-xl border border-border bg-foreground/[0.03]' />
					<RichTextEditor.Content className='min-h-56 rounded-b-xl bg-foreground/[0.03]' />
				</RichTextEditor>
				<AttachmentsCard noteId={note.id} />
				<RevisionHistory noteId={note.id} onRestored={onRestored} />
				<NoteReminder noteId={note.id} />
			</div>
		</div>
	);
}
