import { useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Form } from '~/components/ui/forms-inputs/form/form';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Modal } from '~/components/ui/overlays-feedback/modal/modal';
import { useTranslate } from '~/hooks/use-translate';
import { useCreateProject } from '../api';
import { createProjectFormSchema } from '../schemas';
import { ProjectFields } from './project-fields';

interface NewProjectModalProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

/** "New project": title, Markdown description, goal and tags (`POST /projects`). */
export function NewProjectModal({ onOpenChange, open }: NewProjectModalProps) {
	const t = useTranslate();
	const create = useCreateProject();
	const schema = useMemo(() => createProjectFormSchema(t), [t]);

	return (
		<Modal.Root onOpenChange={onOpenChange} open={open}>
			<Modal.Content className='max-w-xl rounded-2xl p-0' aria-labelledby='new-project-title'>
				<Form
					defaultValues={{ description: '', goalId: '', status: 'active', tagIds: [], title: '' }}
					mode='onSubmit'
					onSubmit={async values => {
						await create.mutateAsync({ description: values.description || undefined, goalId: values.goalId || undefined, tagIds: values.tagIds, title: values.title });
						toast.success(t('projects.toast.created'));
						onOpenChange(false);
					}}
					schema={schema}
				>
					<Modal.Header className='px-6 pt-6'>
						<Modal.Title id='new-project-title'>{t('projects.modal.title')}</Modal.Title>
						<Modal.Description>{t('projects.modal.description')}</Modal.Description>
					</Modal.Header>
					<Modal.Body className='max-h-[60vh] overflow-y-auto px-6 py-4'>
						<ProjectFields />
					</Modal.Body>
					<Modal.Footer className='px-6 pb-6'>
						<Layout.HStack gap='sm' justify='end'>
							<Button onClick={() => onOpenChange(false)} type='button' variant='ghost'>
								<Button.Text>{t('projects.form.cancel')}</Button.Text>
							</Button>
							<Form.Submit>{t('projects.form.create')}</Form.Submit>
						</Layout.HStack>
					</Modal.Footer>
				</Form>
			</Modal.Content>
		</Modal.Root>
	);
}
