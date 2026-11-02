import { Archive, MoreHorizontal, RotateCcw, Trash2, X } from 'lucide-react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Checkbox } from '~/components/ui/forms-inputs/checkbox/checkbox';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Dropdown } from '~/components/ui/overlays-feedback/dropdown/dropdown';
import { useTranslate } from '~/hooks/use-translate';
import type { SettableStatus } from '../api';
import type { InboxStatus } from '../search-params';
import { inboxStyles } from '../styles';

interface SelectionBarProps {
	allSelected: boolean;
	disabled: boolean;
	onClear: () => void;
	onSetStatus: (status: SettableStatus) => void;
	onToggleAll: (checked: boolean) => void;
	selectedCount: number;
	someSelected: boolean;
	status: InboxStatus;
}

/** "Select all" for the current page plus the "…" menu with the bulk actions of the active status (there is no batch endpoint: one request per item). */
export function SelectionBar({ allSelected, disabled, onClear, onSetStatus, onToggleAll, selectedCount, someSelected, status }: SelectionBarProps) {
	const t = useTranslate();
	const hasSelection = selectedCount > 0;

	return (
		<Layout.HStack gap='md'>
			<Checkbox checked={allSelected} disabled={disabled} indeterminate={someSelected} onCheckedChange={onToggleAll}>
				<Checkbox.Toggle />
				<Checkbox.Label className='text-sm text-muted-foreground'>{hasSelection ? t('inbox.selection.count', { count: selectedCount }) : t('inbox.selection.all')}</Checkbox.Label>
			</Checkbox>
			<Dropdown>
				<Dropdown.Trigger>
					<Button aria-label={t('inbox.actions.more')} className={`${inboxStyles.iconButton} border border-border`} disabled={!hasSelection} size='icon' variant='ghost'>
						<Button.Icon icon={MoreHorizontal} />
					</Button>
				</Dropdown.Trigger>
				<Dropdown.Content align='end'>
					{status === 'pending' && (
						<Dropdown.Item onSelect={() => onSetStatus('archived')}>
							<Archive aria-hidden className='size-4' />
							{t('inbox.actions.archiveSelected')}
						</Dropdown.Item>
					)}
					{status !== 'pending' && (
						<Dropdown.Item onSelect={() => onSetStatus('pending')}>
							<RotateCcw aria-hidden className='size-4' />
							{t('inbox.actions.restoreSelected')}
						</Dropdown.Item>
					)}
					{status !== 'discarded' && (
						<Dropdown.Item onSelect={() => onSetStatus('discarded')} variant='destructive'>
							<Trash2 aria-hidden className='size-4' />
							{t('inbox.actions.discardSelected')}
						</Dropdown.Item>
					)}
					<Dropdown.Separator />
					<Dropdown.Item onSelect={onClear}>
						<X aria-hidden className='size-4' />
						{t('inbox.actions.clearSelection')}
					</Dropdown.Item>
				</Dropdown.Content>
			</Dropdown>
		</Layout.HStack>
	);
}
