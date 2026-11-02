import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '~/components/ui/overlays-feedback/confirm-dialog/confirm-dialog';
import { useRetained } from '~/hooks/use-retained';
import { useTranslate } from '~/hooks/use-translate';
import { type Tag, useDeleteTags } from '../api';

interface DeleteTagsDialogProps {
	onClose: () => void;
	/** Called after the tags were deleted (to clear the selection). */
	onDeleted: () => void;
	/** The tags to delete; the dialog is open while they are set. */
	tags: Tag[] | undefined;
}

/** Asks before deleting one or several tags (`DELETE /tags/:id`, one request each) and says how many items lose them. Deleting cannot be undone. */
export function DeleteTagsDialog({ onClose, onDeleted, tags }: DeleteTagsDialogProps) {
	const t = useTranslate();
	const remove = useDeleteTags();
	// Keeps the last tags while the dialog fades out, so it does not go blank mid-animation.
	const shown = useRetained(tags);
	const count = shown?.length ?? 0;
	const items = (shown ?? []).reduce((sum, tag) => sum + tag.usage.tasks + tag.usage.projects + tag.usage.notes, 0);

	return (
		<ConfirmDialog.Root
			lang={{ cancel: t('tags.delete.cancel'), confirm: t('tags.delete.confirm') }}
			onConfirm={async () => {
				if (!shown) return;
				const deleted = await remove.mutateAsync(shown.map(tag => tag.id));
				toast.success(t(deleted === 1 ? 'tags.toast.deleted_one' : 'tags.toast.deleted_other', { count: deleted }));
				onDeleted();
			}}
			onOpenChange={open => !open && onClose()}
			open={tags !== undefined}
			variant='destructive'
		>
			<ConfirmDialog.Content>
				<ConfirmDialog.Icon icon={Trash2} />
				<ConfirmDialog.Title>{t(count === 1 ? 'tags.delete.title_one' : 'tags.delete.title_other', { count })}</ConfirmDialog.Title>
				<ConfirmDialog.Description>{items === 0 ? t('tags.delete.unused') : t(items === 1 ? 'tags.delete.used_one' : 'tags.delete.used_other', { count: items })}</ConfirmDialog.Description>
				<ConfirmDialog.Footer>
					<ConfirmDialog.Cancel />
					<ConfirmDialog.Confirm />
				</ConfirmDialog.Footer>
			</ConfirmDialog.Content>
		</ConfirmDialog.Root>
	);
}
