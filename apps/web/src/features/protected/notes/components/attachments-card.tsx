import { useQueryClient } from '@tanstack/react-query';
import { Download, Paperclip, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Collapsible } from '~/components/ui/data-display/collapsible/collapsible';
import { UploadDropzone } from '~/components/ui/forms-inputs/upload-dropzone/upload-dropzone';
import { FileIcon } from '~/components/ui/foundations/file-icon/file-icon';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Modal } from '~/components/ui/overlays-feedback/modal/modal';
import { formatFileSize } from '~/components/ui/utils/files/fileTypes';
import { useTranslate } from '~/hooks/use-translate';
import { type NoteAttachment, noteFileUrl, refreshNoteFiles, uploadNoteFile, useDeleteNoteFile, useNoteFiles } from '../api';

/** Client-side limits: the API only bounds a single file (`ATTACHMENT_MAX_BYTES`, 50 MB); the count and the running total are enforced here. */
const MAX_FILES = 10;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const COLLAPSED_COUNT = 3;

interface AttachmentsCardProps {
	noteId: string;
}

/** Attachments of a note: a compact list (FileIcon, size, download, remove) plus an upload modal that PUTs straight to Supabase Storage. */
export function AttachmentsCard({ noteId }: AttachmentsCardProps) {
	const t = useTranslate();
	const queryClient = useQueryClient();
	const files = useNoteFiles(noteId);
	const remove = useDeleteNoteFile(noteId);
	const [uploadOpen, setUploadOpen] = useState(false);
	const [expanded, setExpanded] = useState(false);
	// Bytes committed by uploads still in flight in the open modal, so concurrent files are checked against the same running total.
	const sessionBytesRef = useRef(0);

	const items = files.data ?? [];
	const totalBytes = items.reduce((sum, item) => sum + item.sizeBytes, 0);
	const remainingSlots = Math.max(MAX_FILES - items.length, 0);
	const isFull = remainingSlots === 0;

	const visible = items.slice(0, COLLAPSED_COUNT);

	const openUpload = () => {
		sessionBytesRef.current = 0;
		setUploadOpen(true);
	};

	const handleUpload = async (file: File, onProgress: (percent: number) => void): Promise<string> => {
		const projected = totalBytes + sessionBytesRef.current + file.size;
		if (projected > MAX_TOTAL_BYTES) throw new Error(t('notes.files.totalExceeded', { size: formatFileSize(MAX_TOTAL_BYTES) }));
		sessionBytesRef.current += file.size;
		const result = await uploadNoteFile(noteId, file, onProgress);
		return result.url;
	};

	const handleUploadComplete = () => refreshNoteFiles(queryClient, noteId);

	const handleDownload = async (attachment: NoteAttachment) => {
		try {
			const { url } = await noteFileUrl(attachment.id);
			window.open(url, '_blank', 'noopener,noreferrer');
		} catch {
			toast.error(t('notes.files.downloadError'));
		}
	};

	const handleRemove = (attachment: NoteAttachment) => {
		remove.mutate(attachment.id, {
			onError: () => toast.error(t('notes.files.removeError')),
			onSuccess: () => toast.success(t('notes.toast.fileRemoved')),
		});
	};

	return (
		<div className='flex flex-col gap-3 rounded-2xl border border-border bg-foreground/[0.03] p-4'>
			<Layout.HStack align='center' justify='between'>
				<Typography.Span className='text-sm font-medium'>{t('notes.files.title', { count: items.length })}</Typography.Span>
				<Button disabled={isFull} onClick={openUpload} title={isFull ? t('notes.files.full') : undefined} type='button' variant='secondary'>
					<Button.Icon icon={Plus} />
					<Button.Text>{t('notes.files.add')}</Button.Text>
				</Button>
			</Layout.HStack>

			{files.isLoading ? (
				<Skeleton className='gap-2' label={t('notes.files.loading')}>
					{[0, 1].map(key => (
						<Skeleton.Item className='h-12 w-full rounded-lg' key={key} />
					))}
				</Skeleton>
			) : files.isError ? (
				<Layout.Stack align='center' className='py-6 text-center' gap='sm'>
					<Typography.Span className='text-xs text-muted-foreground'>{t('notes.files.loadError')}</Typography.Span>
					<Button onClick={() => files.refetch()} variant='secondary'>
						<Button.Text>{t('notes.files.retry')}</Button.Text>
					</Button>
				</Layout.Stack>
			) : items.length === 0 ? (
				<Layout.Stack align='center' className='py-6 text-center' gap='sm'>
					<Icon aria-hidden className='text-muted-foreground' icon={Paperclip} size='lg' />
					<Typography.Span className='text-xs text-muted-foreground'>{t('notes.files.empty')}</Typography.Span>
				</Layout.Stack>
			) : (
				<Collapsible.Root onOpenChange={setExpanded} open={expanded}>
					<ul className='flex flex-col gap-2'>
						{visible.map(attachment => (
							<AttachmentRow attachment={attachment} key={attachment.id} onDownload={handleDownload} onRemove={handleRemove} />
						))}
					</ul>
					{items.length > COLLAPSED_COUNT && (
						<>
							<Collapsible.Content>
								<ul className='flex flex-col gap-2'>
									{items.slice(COLLAPSED_COUNT).map(attachment => (
										<AttachmentRow attachment={attachment} key={attachment.id} onDownload={handleDownload} onRemove={handleRemove} />
									))}
								</ul>
							</Collapsible.Content>
							<Collapsible.Trigger chevron={false} className='text-xs text-muted-foreground'>
								{expanded ? t('notes.files.viewLess') : t('notes.files.viewAll')}
							</Collapsible.Trigger>
						</>
					)}
				</Collapsible.Root>
			)}

			<Modal.Root onOpenChange={setUploadOpen} open={uploadOpen}>
				<Modal.Content aria-labelledby='attachments-upload-title' className='max-w-md rounded-2xl p-0'>
					<Modal.Header className='px-6 pt-6'>
						<Modal.Title id='attachments-upload-title'>{t('notes.files.uploadTitle')}</Modal.Title>
						<Modal.Description>{t('notes.files.uploadDescription')}</Modal.Description>
					</Modal.Header>
					<Modal.Body className='flex flex-col gap-3 px-6 py-4'>
						<Typography.Span className='text-xs text-muted-foreground'>
							{t('notes.files.limits', { max: MAX_FILES, size: formatFileSize(MAX_TOTAL_BYTES), used: formatFileSize(totalBytes) })}
						</Typography.Span>
						<UploadDropzone.Root
							accept={['*/*']}
							key={String(uploadOpen)}
							lang={{
								cancelled: t('notes.files.dropzone.cancelled'),
								dragOrClickPlural: () => t('notes.files.dropzone.dragOrClick'),
								dropHere: t('notes.files.dropzone.dropHere'),
								invalidType: () => t('notes.files.dropzone.invalidType'),
								maxFiles: max => t('notes.files.sessionLimit', { max }),
								tooLarge: (_noun, limit) => t('notes.files.dropzone.tooLarge', { limit }),
								uploaded: t('notes.files.dropzone.uploaded'),
								uploadFailed: () => t('notes.files.dropzone.uploadFailed'),
								uploading: () => t('notes.files.dropzone.uploading'),
							}}
							maxFiles={remainingSlots}
							maxSize={MAX_FILE_BYTES}
							onUpload={handleUpload}
							onUploadComplete={handleUploadComplete}
						>
							<UploadDropzone.Trigger />
							<UploadDropzone.List />
							<UploadDropzone.Notice />
							<UploadDropzone.Error />
						</UploadDropzone.Root>
					</Modal.Body>
					<Modal.Footer className='px-6 pb-6'>
						<Layout.HStack justify='end'>
							<Button onClick={() => setUploadOpen(false)} type='button'>
								<Button.Text>{t('notes.files.done')}</Button.Text>
							</Button>
						</Layout.HStack>
					</Modal.Footer>
				</Modal.Content>
			</Modal.Root>
		</div>
	);
}

interface AttachmentRowProps {
	attachment: NoteAttachment;
	onDownload: (attachment: NoteAttachment) => void;
	onRemove: (attachment: NoteAttachment) => void;
}

function AttachmentRow({ attachment, onDownload, onRemove }: AttachmentRowProps) {
	const t = useTranslate();
	return (
		<li className='flex items-center gap-3 rounded-lg border border-border p-2'>
			<FileIcon.Root aria-hidden file={attachment.name} mimeType={attachment.mimeType} size='sm' />
			<div className='flex min-w-0 flex-1 flex-col gap-0.5'>
				<p className='truncate text-sm font-medium'>{attachment.name}</p>
				<p className='text-xs text-muted-foreground'>{formatFileSize(attachment.sizeBytes)}</p>
			</div>
			<Button aria-label={t('notes.files.download', { name: attachment.name })} onClick={() => onDownload(attachment)} size='icon' type='button' variant='ghost'>
				<Button.Icon icon={Download} />
			</Button>
			<Button aria-label={t('notes.files.remove', { name: attachment.name })} onClick={() => onRemove(attachment)} size='icon' type='button' variant='ghost'>
				<Button.Icon icon={Trash2} />
			</Button>
		</li>
	);
}
