import { useMemo } from 'react';
import { RichTextEditor, type RichTextEditorLang } from '~/components/ui/forms-inputs/rich-text-editor/rich-text-editor';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';

interface MarkdownFieldProps {
	/** Message shown under the editor (a validation error). */
	error?: string;
	label: string;
	/** Markdown text of the field. */
	onChange: (markdown: string) => void;
	placeholder: string;
	value: string;
}

/** A form field for a Markdown description: the rich text editor (TipTap) reading and writing Markdown, styled like the other glass fields. */
export function MarkdownField({ error, label, onChange, placeholder, value }: MarkdownFieldProps) {
	const t = useTranslate();
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

	return (
		<div className='flex flex-col gap-1.5'>
			<span className='text-sm font-medium font-primary text-foreground'>{label}</span>
			<RichTextEditor lang={lang} markdown={value} onMarkdownChange={onChange} placeholder={placeholder}>
				<RichTextEditor.BubbleMenu />
				<RichTextEditor.Toolbar className={cn('rounded-t-xl border border-border bg-foreground/[0.03]', error && 'border-destructive')} />
				<RichTextEditor.Content className={cn('min-h-56 rounded-b-xl bg-foreground/[0.03] focus-within:border-border-strong', error && 'border-destructive')} />
			</RichTextEditor>
			{error && <p className='text-xs text-destructive'>{error}</p>}
		</div>
	);
}
