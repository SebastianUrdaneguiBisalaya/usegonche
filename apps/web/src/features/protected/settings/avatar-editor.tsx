import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Avatar } from '~/components/ui/data-display/avatar/avatar';
import { UploadDropzone } from '~/components/ui/forms-inputs/upload-dropzone/upload-dropzone';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Modal } from '~/components/ui/overlays-feedback/modal/modal';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { initialsOf } from '../shared/initials';
import { uploadAvatar, useUpdateProfile } from './api';

interface AvatarEditorProps {
	avatarUrl: string | null;
	/** `false` for Google accounts: the photo is the Google one, so there is no pencil and no dialog. */
	editable: boolean;
	name: string;
}

const initialsClassName = 'flex items-center justify-center bg-muted text-lg font-semibold text-muted-foreground';
const MAX_BYTES = 5 * 1024 * 1024;

/** The profile picture with a pencil at its top right: it opens a dialog to upload a new one to Storage, and saving puts its URL on the profile. */
export function AvatarEditor({ avatarUrl, editable, name }: AvatarEditorProps) {
	const t = useTranslate();
	const update = useUpdateProfile();
	const [open, setOpen] = useState(false);
	const [uploaded, setUploaded] = useState<string>();

	const close = () => {
		setOpen(false);
		setUploaded(undefined);
	};

	const save = () => {
		if (!uploaded) return;
		update.mutate(
			{ avatarUrl: uploaded },
			{
				onSuccess: () => {
					toast.success(t('protected.settings.account.avatar.saved'));
					close();
				},
			}
		);
	};

	return (
		<>
			<div className='relative size-20 shrink-0'>
				<Avatar className='size-20'>
					{avatarUrl ? (
						<>
							<Avatar.Img alt={name} src={avatarUrl} />
							<Avatar.Skeleton />
							<Avatar.Fallback className={initialsClassName}>{initialsOf(name)}</Avatar.Fallback>
						</>
					) : (
						<span className={cn('absolute inset-0', initialsClassName)}>{initialsOf(name)}</span>
					)}
				</Avatar>
				{editable && (
					<Button
						aria-label={t('protected.settings.account.avatar.edit')}
						className='absolute -top-1 -right-1 size-8 rounded-full border border-border bg-background p-0'
						onClick={() => setOpen(true)}
						size='icon'
						type='button'
						variant='secondary'
					>
						<Button.Icon icon={Pencil} />
					</Button>
				)}
			</div>

			<Modal.Root onOpenChange={next => !next && close()} open={open}>
				<Modal.Content aria-labelledby='avatar-title' className='max-w-md rounded-2xl p-0'>
					<Modal.Header className='px-6 pt-6'>
						<Modal.Title id='avatar-title'>{t('protected.settings.account.avatar.title')}</Modal.Title>
						<Modal.Description>{t('protected.settings.account.avatar.description')}</Modal.Description>
					</Modal.Header>
					<Modal.Body className='px-6 py-4'>
						<UploadDropzone.Root
							key={String(open)}
							lang={{
								dragOrClick: t('protected.settings.account.avatar.dragOrClick'),
								dropHere: t('protected.settings.account.avatar.dropHere'),
								invalidImageType: t('protected.settings.account.avatar.invalidType'),
								maxSize: limit => t('protected.settings.account.avatar.maxSize', { limit }),
								tooLarge: (_noun, limit) => t('protected.settings.account.avatar.tooLarge', { limit }),
								uploaded: t('protected.settings.account.avatar.uploaded'),
								uploading: () => t('protected.settings.account.avatar.uploading'),
							}}
							maxSize={MAX_BYTES}
							onUpload={uploadAvatar}
							onUploadComplete={setUploaded}
						>
							<UploadDropzone.Preview />
							<UploadDropzone.Progress />
							<UploadDropzone.Trigger />
							<UploadDropzone.Error />
						</UploadDropzone.Root>
					</Modal.Body>
					<Modal.Footer className='px-6 pb-6'>
						<Layout.HStack gap='sm' justify='end'>
							<Button onClick={close} type='button' variant='ghost'>
								<Button.Text>{t('protected.settings.account.cancel')}</Button.Text>
							</Button>
							<Button disabled={!uploaded} loading={update.isPending} onClick={save} type='button'>
								<Button.Text>{t('protected.settings.account.save')}</Button.Text>
							</Button>
						</Layout.HStack>
					</Modal.Footer>
				</Modal.Content>
			</Modal.Root>
		</>
	);
}
