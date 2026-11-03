import { useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Form } from '~/components/ui/forms-inputs/form/form';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Modal } from '~/components/ui/overlays-feedback/modal/modal';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import { type Note, useCreateNote } from '../api';
import { createNoteFormSchema, TITLE_MAX } from '../schemas';

interface NewNoteModalProps {
	/** What the new note is linked to from the start (the task or project whose drawer opened the modal). */
	links?: { projectId?: string; taskIds?: string[] };
	onCreated?: (note: Note) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

/** "New note": only the title; the text is written afterwards in the editor (`POST /notes`). */
export function NewNoteModal({ links, onCreated, onOpenChange, open }: NewNoteModalProps) {
	const t = useTranslate();
	const create = useCreateNote();
	const schema = useMemo(() => createNoteFormSchema(t), [t]);

	return (
		<Modal.Root onOpenChange={onOpenChange} open={open}>
			<Modal.Content aria-labelledby='new-note-title' className='max-w-md rounded-2xl p-0'>
				<Form
					defaultValues={{ title: '' }}
					mode='onSubmit'
					onSubmit={async values => {
						const note = await create.mutateAsync({ projectId: links?.projectId, taskIds: links?.taskIds, title: values.title });
						toast.success(t('notes.toast.created'));
						onOpenChange(false);
						onCreated?.(note);
					}}
					schema={schema}
				>
					<Modal.Header className='px-6 pt-6'>
						<Modal.Title id='new-note-title'>{t('notes.modal.title')}</Modal.Title>
						<Modal.Description>{t('notes.modal.description')}</Modal.Description>
					</Modal.Header>
					<Modal.Body className='px-6 py-4'>
						<Form.Field name='title'>
							{field => (
								<Input className={listStyles.field} errorMessage={field.error} maxLength={TITLE_MAX}>
									<Input.Label>{t('notes.form.title.label')}</Input.Label>
									<Input.Field autoComplete='off' placeholder={t('notes.form.title.placeholder')} {...field.inputProps} />
								</Input>
							)}
						</Form.Field>
					</Modal.Body>
					<Modal.Footer className='px-6 pb-6'>
						<Layout.HStack gap='sm' justify='end'>
							<Button onClick={() => onOpenChange(false)} type='button' variant='ghost'>
								<Button.Text>{t('notes.form.cancel')}</Button.Text>
							</Button>
							<Form.Submit>{t('notes.form.create')}</Form.Submit>
						</Layout.HStack>
					</Modal.Footer>
				</Form>
			</Modal.Content>
		</Modal.Root>
	);
}
