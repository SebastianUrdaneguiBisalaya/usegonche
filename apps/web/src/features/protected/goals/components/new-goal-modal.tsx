import { useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Form } from '~/components/ui/forms-inputs/form/form';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Modal } from '~/components/ui/overlays-feedback/modal/modal';
import { useTranslate } from '~/hooks/use-translate';
import { useCreateGoal } from '../api';
import { createGoalFormSchema } from '../schemas';
import { GoalFields } from './goal-fields';

interface NewGoalModalProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

/** "New goal": title, Markdown description and an optional target date (`POST /goals`). */
export function NewGoalModal({ onOpenChange, open }: NewGoalModalProps) {
	const t = useTranslate();
	const create = useCreateGoal();
	const schema = useMemo(() => createGoalFormSchema(t), [t]);

	return (
		<Modal.Root onOpenChange={onOpenChange} open={open}>
			<Modal.Content aria-labelledby='new-goal-title' className='max-w-xl rounded-2xl p-0'>
				<Form
					defaultValues={{ description: '', status: 'active', targetDate: '', title: '' }}
					mode='onSubmit'
					onSubmit={async values => {
						await create.mutateAsync({ description: values.description || undefined, targetDate: values.targetDate || undefined, title: values.title });
						toast.success(t('goals.toast.created'));
						onOpenChange(false);
					}}
					schema={schema}
				>
					<Modal.Header className='px-6 pt-6'>
						<Modal.Title id='new-goal-title'>{t('goals.modal.title')}</Modal.Title>
						<Modal.Description>{t('goals.modal.description')}</Modal.Description>
					</Modal.Header>
					<Modal.Body className='max-h-[60vh] overflow-y-auto px-6 py-4'>
						<GoalFields />
					</Modal.Body>
					<Modal.Footer className='px-6 pb-6'>
						<Layout.HStack gap='sm' justify='end'>
							<Button onClick={() => onOpenChange(false)} type='button' variant='ghost'>
								<Button.Text>{t('goals.form.cancel')}</Button.Text>
							</Button>
							<Form.Submit>{t('goals.form.create')}</Form.Submit>
						</Layout.HStack>
					</Modal.Footer>
				</Form>
			</Modal.Content>
		</Modal.Root>
	);
}
