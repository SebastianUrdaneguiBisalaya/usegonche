import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '~/components/ui/overlays-feedback/confirm-dialog/confirm-dialog';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { type CalendarEventItem, useDeleteEvent } from '../api';

interface DeleteEventDialogProps {
	event: CalendarEventItem | undefined;
	onClose: () => void;
}

/** Asks before deleting a calendar event. Deleting it gives its time back to the day's capacity. */
export function DeleteEventDialog({ event, onClose }: DeleteEventDialogProps) {
	const t = useTranslate();
	const remove = useDeleteEvent();

	return (
		<ConfirmDialog.Root
			lang={{ cancel: t('calendar.delete.cancel'), confirm: t('calendar.delete.confirm') }}
			onConfirm={async () => {
				if (!event) return;
				try {
					await remove.mutateAsync(event.id);
					toast.success(t('calendar.toast.deleted'));
					onClose();
				} catch (error) {
					toast.error(getApiErrorMessage(error));
				}
			}}
			onOpenChange={open => !open && onClose()}
			open={event !== undefined}
			variant='destructive'
		>
			<ConfirmDialog.Content>
				<ConfirmDialog.Icon icon={Trash2} />
				<ConfirmDialog.Title>{t('calendar.delete.title')}</ConfirmDialog.Title>
				<ConfirmDialog.Description>{t('calendar.delete.description', { title: event?.title ?? '' })}</ConfirmDialog.Description>
				<ConfirmDialog.Footer>
					<ConfirmDialog.Cancel />
					<ConfirmDialog.Confirm />
				</ConfirmDialog.Footer>
			</ConfirmDialog.Content>
		</ConfirmDialog.Root>
	);
}
