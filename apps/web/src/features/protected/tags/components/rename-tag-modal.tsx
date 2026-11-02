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
import { type Tag, useRenameTag } from '../api';
import { createRenameSchema, NAME_MAX, type RenameValues } from '../schemas';

interface RenameTagModalProps {
	onClose: () => void;
	/** The tag being renamed; the modal is open while it is set. */
	tag: Tag | undefined;
}

/** Renames a tag (`PATCH /tags/:id`). Nothing is sent when the name did not change; a name already taken shows under the field. */
export function RenameTagModal({ onClose, tag }: RenameTagModalProps) {
	const t = useTranslate();
	const rename = useRenameTag();
	const schema = useMemo(() => createRenameSchema(t), [t]);
	// Keeps the last tag while the dialog fades out, so it does not go blank mid-animation.
	const shown = useRetained(tag);

	return (
		<Modal.Root onOpenChange={open => !open && onClose()} open={tag !== undefined}>
			<Modal.Content aria-labelledby='rename-tag-title' className='max-w-md rounded-2xl p-0'>
				{shown && (
					<Form
						defaultValues={{ name: shown.name }}
						key={shown.id}
						mode='onSubmit'
						onSubmit={async (values, form) => {
							const changed = diffPayload<RenameValues>({ name: shown.name }, values);
							if (changed.name !== undefined) {
								try {
									await rename.mutateAsync({ id: shown.id, name: changed.name });
									toast.success(t('tags.toast.updated'));
								} catch (error) {
									if (error instanceof ApiError && error.code === 'already_exists') {
										form.setError('name', { message: t('tags.rename.exists') });
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
							<Modal.Title id='rename-tag-title'>{t('tags.rename.title')}</Modal.Title>
							<Modal.Description>{t('tags.rename.description')}</Modal.Description>
						</Modal.Header>
						<Modal.Body className='px-6 py-4'>
							<Form.Field name='name'>
								{field => (
									<Input className={listStyles.field} errorMessage={field.error} maxLength={NAME_MAX}>
										<Input.Label>{t('tags.rename.label')}</Input.Label>
										<Input.Field autoComplete='off' autoFocus placeholder={t('tags.rename.placeholder')} {...field.inputProps} />
									</Input>
								)}
							</Form.Field>
						</Modal.Body>
						<Modal.Footer className='px-6 pb-6'>
							<Layout.HStack gap='sm' justify='end'>
								<Button onClick={onClose} type='button' variant='ghost'>
									<Button.Text>{t('tags.rename.cancel')}</Button.Text>
								</Button>
								<Form.Submit>{t('tags.rename.save')}</Form.Submit>
							</Layout.HStack>
						</Modal.Footer>
					</Form>
				)}
			</Modal.Content>
		</Modal.Root>
	);
}
