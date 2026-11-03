import { useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Form } from '~/components/ui/forms-inputs/form/form';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Modal } from '~/components/ui/overlays-feedback/modal/modal';
import { useRetained } from '~/hooks/use-retained';
import { useTranslate } from '~/hooks/use-translate';
import { ApiError } from '~/lib/api-error';
import { diffPayload } from '~/utils/diff-payload';
import { listStyles } from '../../shared/styles';
import { type Tag, useUpdateTag } from '../api';
import { createEditSchema, type EditValues, NAME_MAX } from '../schemas';
import { TagColorField } from './tag-color-field';

interface EditTagModalProps {
	onClose: () => void;
	/** The tag being edited; the modal is open while it is set. */
	tag: Tag | undefined;
}

/** Edits the name and the color of a tag (`PATCH /tags/:id`). Only what changed is sent, nothing when nothing did; a name already taken shows under the field. */
export function EditTagModal({ onClose, tag }: EditTagModalProps) {
	const t = useTranslate();
	const update = useUpdateTag();
	const schema = useMemo(() => createEditSchema(t), [t]);
	// Keeps the last tag while the dialog fades out, so it does not go blank mid-animation.
	const shown = useRetained(tag);

	return (
		<Modal.Root onOpenChange={open => !open && onClose()} open={tag !== undefined}>
			<Modal.Content aria-labelledby='edit-tag-title' className='max-w-md rounded-2xl p-0'>
				{shown && (
					<Form
						defaultValues={{ color: shown.color ?? '', name: shown.name }}
						key={shown.id}
						mode='onSubmit'
						onSubmit={async (values, form) => {
							const changed = diffPayload<EditValues>({ color: shown.color ?? '', name: shown.name }, values);
							if (Object.keys(changed).length > 0) {
								try {
									await update.mutateAsync({
										changes: { ...(changed.name !== undefined && { name: changed.name }), ...(changed.color !== undefined && { color: changed.color || null }) },
										id: shown.id,
									});
									toast.success(t('tags.toast.updated'));
								} catch (error) {
									if (error instanceof ApiError && error.code === 'already_exists') {
										form.setError('name', { message: t('tags.edit.exists') });
										return;
									}
									throw error;
								}
							}
							onClose();
						}}
						schema={schema}
					>
						<Modal.Header className='px-6 pt-6'>
							<Modal.Title id='edit-tag-title'>{t('tags.edit.title')}</Modal.Title>
							<Modal.Description>{t('tags.edit.description')}</Modal.Description>
						</Modal.Header>
						<Modal.Body className='px-6 py-4'>
							<Layout.Stack gap='md'>
								<Form.Field name='name'>
									{field => (
										<Input className={listStyles.field} errorMessage={field.error} maxLength={NAME_MAX}>
											<Input.Label>{t('tags.edit.label')}</Input.Label>
											<Input.Field autoComplete='off' autoFocus placeholder={t('tags.edit.placeholder')} {...field.inputProps} />
										</Input>
									)}
								</Form.Field>
								<Form.Field name='color'>
									{field => (
										<Layout.Stack gap='xs'>
											<span className='text-sm font-medium'>{t('tags.color.label')}</span>
											<TagColorField onChange={field.onChange} value={field.value as string} />
										</Layout.Stack>
									)}
								</Form.Field>
							</Layout.Stack>
						</Modal.Body>
						<Modal.Footer className='px-6 pb-6'>
							<Layout.HStack gap='sm' justify='end'>
								<Button onClick={onClose} type='button' variant='ghost'>
									<Button.Text>{t('tags.edit.cancel')}</Button.Text>
								</Button>
								<Form.Submit>{t('tags.edit.save')}</Form.Submit>
							</Layout.HStack>
						</Modal.Footer>
					</Form>
				)}
			</Modal.Content>
		</Modal.Root>
	);
}
