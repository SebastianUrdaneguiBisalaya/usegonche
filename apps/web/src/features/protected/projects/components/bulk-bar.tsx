import { Archive, ChevronDown, RotateCcw, X } from 'lucide-react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Separator } from '~/components/ui/foundations/separator/separator';
import { Dropdown } from '~/components/ui/overlays-feedback/dropdown/dropdown';
import { useTranslate } from '~/hooks/use-translate';
import type { BulkAction } from '../api';
import { type DisplayStatus, statusDot } from '../display';
import { type ProjectStatus, projectStatuses } from '../search-params';

interface BulkBarProps {
	/** Tab being listed: archived projects can only be restored. */
	archived: boolean;
	count: number;
	disabled: boolean;
	onAction: (action: BulkAction) => void;
	onClear: () => void;
}

const pill = 'gap-2 rounded-full border-border bg-foreground/[0.03] px-4 py-2';

const setLabel: Record<ProjectStatus, 'projects.actions.setActive' | 'projects.actions.setCompleted' | 'projects.actions.setOnHold'> = {
	active: 'projects.actions.setActive',
	completed: 'projects.actions.setCompleted',
	on_hold: 'projects.actions.setOnHold',
};

/** "3 selected" plus the actions that apply to the selection: set a status, archive or restore (one request per project, there is no batch endpoint). */
export function BulkBar({ archived, count, disabled, onAction, onClear }: BulkBarProps) {
	const t = useTranslate();

	return (
		<div className='flex min-w-0 flex-wrap items-center gap-2'>
			<span className='mr-2 text-sm font-medium tabular-nums'>{t('projects.selection.count', { count })}</span>
			{!archived &&
				projectStatuses.map(status => (
					<Button className={pill} disabled={disabled} key={status} onClick={() => onAction({ status })} variant='secondary'>
						<span aria-hidden className={`size-2 rounded-full ${statusDot[status as DisplayStatus]}`} />
						<Button.Text className='text-xs'>{t(setLabel[status])}</Button.Text>
					</Button>
				))}
			<Separator className='mx-1 hidden h-6 sm:block' orientation='vertical' />
			<Button className={pill} disabled={disabled} onClick={() => onAction({ archived: !archived })} variant='secondary'>
				<Button.Icon icon={archived ? RotateCcw : Archive} />
				<Button.Text className='text-xs'>{archived ? t('projects.actions.restore') : t('projects.actions.archive')}</Button.Text>
			</Button>
			<Dropdown>
				<Dropdown.Trigger>
					<Button className={pill} variant='secondary'>
						<Button.Text className='text-xs'>{t('projects.actions.more')}</Button.Text>
						<Button.Icon icon={ChevronDown} />
					</Button>
				</Dropdown.Trigger>
				<Dropdown.Content align='start'>
					<Dropdown.Item onSelect={onClear}>
						<X aria-hidden className='size-4' />
						{t('projects.actions.clearSelection')}
					</Dropdown.Item>
				</Dropdown.Content>
			</Dropdown>
		</div>
	);
}
