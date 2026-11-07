import { ArrowLeft, ArrowRight, History, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Drawer } from '~/components/ui/overlays-feedback/drawer/drawer';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { formatRelativeLong } from '../../shared/relative-time';
import { useRestoreRevision, useRevision, useRevisions } from '../api';

interface RevisionHistoryProps {
	noteId: string;
	/** Called after a version is restored, so the editor can reload its draft from the note. */
	onRestored?: () => void;
}

/** The "Revision history" card at the foot of the editor, and the drawer it opens: the kept versions, a preview of one and its restore. */
export function RevisionHistory({ noteId, onRestored }: RevisionHistoryProps) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const [open, setOpen] = useState(false);
	const [selectedId, setSelectedId] = useState<string>();
	const revisions = useRevisions(noteId, open);
	const revision = useRevision(noteId, selectedId);
	const restore = useRestoreRevision();

	const formatDate = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

	const handleOpenChange = (next: boolean) => {
		setOpen(next);
		if (!next) setSelectedId(undefined);
	};

	const handleRestore = () => {
		if (!selectedId) return;
		restore.mutate(
			{ id: noteId, revisionId: selectedId },
			{
				onError: () => toast.error(t('notes.history.loadError')),
				onSuccess: () => {
					toast.success(t('notes.toast.restored'));
					handleOpenChange(false);
					onRestored?.();
				},
			}
		);
	};

	const items = revisions.data?.data ?? [];

	return (
		<>
			<div className='flex items-center gap-4 rounded-2xl border border-border bg-foreground/[0.03] p-4'>
				<Icon aria-hidden className='text-muted-foreground' icon={History} size='lg' />
				<div className='flex min-w-0 flex-1 flex-col'>
					<p className='text-sm font-medium'>{t('notes.history.title')}</p>
					<p className='truncate text-xs text-muted-foreground'>{t('notes.history.description')}</p>
				</div>
				<Button onClick={() => setOpen(true)} type='button' variant='secondary'>
					<Button.Text>{t('notes.history.view')}</Button.Text>
					<Button.Icon icon={ArrowRight} />
				</Button>
			</div>

			<Drawer.Root onOpenChange={handleOpenChange} open={open}>
				<Drawer.Content>
					<Drawer.Header>
						{selectedId ? (
							<Button onClick={() => setSelectedId(undefined)} type='button' variant='ghost'>
								<Button.Icon icon={ArrowLeft} />
								<Button.Text>{t('notes.history.back')}</Button.Text>
							</Button>
						) : (
							<div className='flex min-w-0 flex-col gap-1'>
								<Drawer.Title>{t('notes.history.drawerTitle')}</Drawer.Title>
								<Drawer.Description>{t('notes.history.drawerDescription')}</Drawer.Description>
							</div>
						)}
						<Drawer.Close>
							<Button aria-label={t('notes.history.close')} className='size-8 shrink-0 rounded-full p-0' size='icon' type='button' variant='ghost'>
								<Button.Icon icon={X} />
							</Button>
						</Drawer.Close>
					</Drawer.Header>

					{selectedId ? (
						<>
							<Drawer.Body className='flex flex-col gap-3'>
								{revision.isLoading ? (
									<Skeleton label={t('notes.history.preview')}>
										<Skeleton.Item className='h-6 w-2/3' />
										<Skeleton.Item className='h-4 w-full' />
										<Skeleton.Item className='h-4 w-5/6' />
									</Skeleton>
								) : revision.isError || !revision.data ? (
									<div className='flex flex-col items-center gap-2 py-10 text-center'>
										<p className='text-sm text-muted-foreground'>{t('notes.history.loadError')}</p>
										<Button onClick={() => revision.refetch()} variant='secondary'>
											<Button.Text>{t('notes.history.retry')}</Button.Text>
										</Button>
									</div>
								) : (
									<>
										<p className='text-xs text-muted-foreground'>{t('notes.history.versionOf', { date: formatDate(revision.data.createdAt) })}</p>
										<h3 className='text-lg font-semibold'>{revision.data.title || t('notes.history.untitled')}</h3>
										{revision.data.body ? (
											<div className='whitespace-pre-wrap break-words rounded-xl border border-border bg-foreground/[0.03] p-4 text-sm'>{revision.data.body}</div>
										) : (
											<p className='text-sm text-muted-foreground'>{t('notes.history.previewEmpty')}</p>
										)}
									</>
								)}
							</Drawer.Body>
							<Drawer.Footer className='flex flex-col gap-2'>
								<p className='text-xs text-muted-foreground'>{t('notes.history.restoreHint')}</p>
								<Button disabled={!revision.data} loading={restore.isPending} onClick={handleRestore} type='button'>
									<Button.Text>{restore.isPending ? t('notes.history.restoring') : t('notes.history.restore')}</Button.Text>
								</Button>
							</Drawer.Footer>
						</>
					) : (
						<Drawer.Body>
							{revisions.isLoading ? (
								<Skeleton label={t('notes.history.drawerTitle')}>
									{[0, 1, 2, 3].map(key => (
										<Skeleton.Item className='h-14 w-full rounded-xl' key={key} />
									))}
								</Skeleton>
							) : revisions.isError ? (
								<div className='flex flex-col items-center gap-2 py-10 text-center'>
									<p className='text-sm text-muted-foreground'>{t('notes.history.loadError')}</p>
									<Button onClick={() => revisions.refetch()} variant='secondary'>
										<Button.Text>{t('notes.history.retry')}</Button.Text>
									</Button>
								</div>
							) : items.length === 0 ? (
								<div className='flex flex-col items-center gap-2 py-10 text-center'>
									<Icon aria-hidden className='text-muted-foreground' icon={History} size='xl' />
									<p className='text-sm font-medium'>{t('notes.history.empty')}</p>
									<p className='text-xs text-muted-foreground'>{t('notes.history.emptyHint')}</p>
								</div>
							) : (
								<ul className='flex flex-col gap-2'>
									{items.map(item => (
										<li key={item.id}>
											<button
												className='flex w-full cursor-pointer flex-col gap-0.5 rounded-xl border border-border bg-foreground/[0.03] p-3 text-left transition-colors hover:bg-foreground/[0.06] focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!'
												onClick={() => setSelectedId(item.id)}
												type='button'
											>
												<span className='truncate text-sm font-medium'>{item.title || t('notes.history.untitled')}</span>
												<span className='text-xs text-muted-foreground' title={formatDate(item.createdAt)}>
													{formatRelativeLong(item.createdAt, locale)}
												</span>
											</button>
										</li>
									))}
								</ul>
							)}
						</Drawer.Body>
					)}
				</Drawer.Content>
			</Drawer.Root>
		</>
	);
}
