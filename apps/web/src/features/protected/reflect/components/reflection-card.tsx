import { Check, LoaderCircle, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { RichTextEditor, type RichTextEditorLang } from '~/components/ui/forms-inputs/rich-text-editor/rich-text-editor';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';

export type SaveStatus = 'error' | 'saved' | 'saving' | 'unsaved';

interface ReflectionCardProps {
	markdown: string;
	onChange: (markdown: string) => void;
	readOnly: boolean;
	status: SaveStatus;
}

/** The free-text reflection of the period, stored as Markdown and saved automatically while the review is open. */
export function ReflectionCard({ markdown, onChange, readOnly, status }: ReflectionCardProps) {
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
		<section className={cn(listStyles.card, 'flex flex-col gap-4 p-5')}>
			<div className='flex items-start justify-between gap-3'>
				<div className='flex flex-col gap-1'>
					<span className='flex items-center gap-3 text-lg font-semibold'>
						<Sparkles aria-hidden className='size-5 text-muted-foreground' />
						{t('reflect.reflection.title')}
					</span>
					<Typography.Span className='text-sm text-muted-foreground'>{t('reflect.reflection.subtitle')}</Typography.Span>
				</div>
				{!readOnly && (
					<span aria-live='polite' className={cn('flex shrink-0 items-center gap-1.5 text-xs', status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
						{status === 'saving' && <Icon className='animate-spin motion-reduce:animate-none' icon={LoaderCircle} size='xs' />}
						{status === 'saved' && <Icon className='text-success' icon={Check} size='xs' />}
						{status === 'unsaved' && <span aria-hidden className='size-1.5 rounded-full bg-current' />}
						{t(`reflect.reflection.status.${status}`)}
					</span>
				)}
			</div>
			<RichTextEditor lang={lang} markdown={markdown} onMarkdownChange={onChange} placeholder={t('reflect.reflection.placeholder')} readOnly={readOnly}>
				{!readOnly && <RichTextEditor.Toolbar className='rounded-t-xl border border-border bg-foreground/[0.03]' />}
				<RichTextEditor.Content className={cn('min-h-32 bg-foreground/[0.03]', readOnly ? 'rounded-xl' : 'rounded-b-xl')} />
			</RichTextEditor>
		</section>
	);
}
