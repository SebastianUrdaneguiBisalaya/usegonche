import { useMemo } from 'react';
import { RichTextEditor, type RichTextEditorLang } from '~/components/ui/forms-inputs/rich-text-editor/rich-text-editor';
import { useTranslate } from '~/hooks/use-translate';
import { DESCRIPTION_MAX } from '../schemas';

interface TaskDescriptionProps {
	/** Markdown of the saved description. */
	markdown: string;
	/** Saves the Markdown (rejects to show the error state). */
	onSave: (markdown: string) => Promise<unknown>;
}

/**
 * The description as a rich text editor that reads and writes Markdown (the API stores it as plain text). It saves by itself a moment
 * after the last edit, and shows the state ("Saving…", "Saved") next to the text.
 */
export function TaskDescription({ markdown, onSave }: TaskDescriptionProps) {
	const t = useTranslate();
	const lang = useMemo<Partial<RichTextEditorLang>>(
		() => ({
			bold: t('tasks.editor.bold'),
			bulletList: t('tasks.editor.bulletList'),
			checklist: t('tasks.editor.checklist'),
			heading1: t('tasks.editor.heading1'),
			heading2: t('tasks.editor.heading2'),
			heading3: t('tasks.editor.heading3'),
			highlight: t('tasks.editor.highlight'),
			italic: t('tasks.editor.italic'),
			link: t('tasks.editor.link'),
			linkUrlPrompt: t('tasks.editor.linkPrompt'),
			numberedList: t('tasks.editor.numberedList'),
			quote: t('tasks.editor.quote'),
			save: t('tasks.editor.save'),
			saveStatus: { error: t('tasks.editor.status.error'), idle: '', saved: t('tasks.editor.status.saved'), saving: t('tasks.editor.status.saving'), unsaved: t('tasks.editor.status.unsaved') },
			strikethrough: t('tasks.editor.strikethrough'),
			underline: t('tasks.editor.underline'),
		}),
		[t]
	);

	return (
		<RichTextEditor
			autoSaveDelay={800}
			className='rounded-xl border border-border bg-foreground/[0.03] focus-within:border-border-strong'
			lang={lang}
			markdown={markdown}
			onMarkdownSave={async next => {
				if (next.length > DESCRIPTION_MAX) throw new Error('too_long');
				await onSave(next);
			}}
			placeholder={t('tasks.editor.placeholder')}
		>
			<RichTextEditor.BubbleMenu />
			{/* The card border is on the root; the content area brings its own, which drew a second box inside it. */}
			<RichTextEditor.Content className='rounded-none border-0' />
			<div className='flex justify-end px-3 pb-2 text-xs text-muted-foreground'>
				<RichTextEditor.SaveStatus />
			</div>
		</RichTextEditor>
	);
}
