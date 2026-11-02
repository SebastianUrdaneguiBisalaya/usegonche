import { ArrowRight, Layers } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Modal } from '~/components/ui/overlays-feedback/modal/modal';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import { useBrainDump } from '../api';

/** Same limit as the API (`BRAIN_DUMP_MAX_ITEMS`). */
const MAX_ITEMS = 200;

/** One non-empty line per item, like the API does. */
const toLines = (text: string): string[] =>
	text
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean);

/** Card that opens the Brain Dump dialog: paste several ideas, one per line, and capture them all at once. */
export function BrainDump() {
	const t = useTranslate();
	const dump = useBrainDump();
	const [open, setOpen] = useState(false);
	const [text, setText] = useState('');
	const count = toLines(text).length;
	const tooMany = count > MAX_ITEMS;

	const submit = () => {
		if (count === 0 || tooMany) return;
		dump.mutate(text, {
			onSuccess: items => {
				toast.success(t('inbox.brainDump.added', { count: items.length }));
				setText('');
				setOpen(false);
			},
		});
	};

	return (
		<>
			<Layout.HStack className={`${listStyles.card} px-6 py-5`} collapseBelow='sm' justify='between'>
				<Layout.HStack gap='lg'>
					<Icon aria-hidden className='text-foreground' icon={Layers} size='xl' />
					<Layout.Stack gap='xs'>
						<Typography.Span className='text-sm font-medium'>{t('inbox.brainDump.title')}</Typography.Span>
						<Typography.Span className='text-xs text-muted-foreground'>{t('inbox.brainDump.description', { max: MAX_ITEMS })}</Typography.Span>
					</Layout.Stack>
				</Layout.HStack>
				<Button className={listStyles.pillTrigger} onClick={() => setOpen(true)} variant='secondary'>
					<Button.Text>{t('inbox.brainDump.open')}</Button.Text>
					<Button.Icon icon={ArrowRight} />
				</Button>
			</Layout.HStack>
			<Modal.Root onOpenChange={setOpen} open={open}>
				<Modal.Content aria-labelledby='brain-dump-title' className='max-w-2xl'>
					<Modal.Header>
						<Modal.Title id='brain-dump-title'>{t('inbox.brainDump.title')}</Modal.Title>
						<Modal.Description>{t('inbox.brainDump.description', { max: MAX_ITEMS })}</Modal.Description>
					</Modal.Header>
					<Modal.Body>
						<Input errorMessage={tooMany ? t('inbox.brainDump.tooMany', { max: MAX_ITEMS }) : undefined}>
							<Input.Textarea
								aria-label={t('inbox.brainDump.title')}
								autoFocus
								className='min-h-56 resize-none'
								onChange={event => setText(event.target.value)}
								placeholder={t('inbox.brainDump.placeholder')}
								value={text}
							/>
						</Input>
					</Modal.Body>
					<Modal.Footer>
						<Typography.Span className='mr-auto text-xs text-muted-foreground'>{t(count === 1 ? 'inbox.brainDump.count_one' : 'inbox.brainDump.count_other', { count })}</Typography.Span>
						<Button onClick={() => setOpen(false)} variant='secondary'>
							<Button.Text>{t('inbox.brainDump.cancel')}</Button.Text>
						</Button>
						<Button disabled={count === 0 || tooMany} loading={dump.isPending} onClick={submit}>
							<Button.Text>{t('inbox.brainDump.submit')}</Button.Text>
						</Button>
					</Modal.Footer>
				</Modal.Content>
			</Modal.Root>
		</>
	);
}
