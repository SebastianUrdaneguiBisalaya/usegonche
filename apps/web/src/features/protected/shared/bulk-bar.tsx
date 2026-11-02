import { ChevronDown, X } from 'lucide-react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Separator } from '~/components/ui/foundations/separator/separator';
import { Dropdown } from '~/components/ui/overlays-feedback/dropdown/dropdown';
import type { StatusLook } from './status-pill';

/** One action of the bar: a label with a colored dot or an icon. */
export interface BulkBarAction extends Omit<StatusLook, 'label'> {
	key: string;
	label: string;
	onClick: () => void;
}

interface BulkBarProps {
	/** Actions that set a state (shown first). */
	actions: readonly BulkBarAction[];
	clearLabel: string;
	countLabel: string;
	moreLabel: string;
	onClear: () => void;
	/** The action shown after a separator (archive / restore). */
	trailing: BulkBarAction;
}

const pill = 'gap-2 rounded-full border-border bg-foreground/[0.03] px-4 py-2';

function ActionButton({ action }: { action: BulkBarAction }) {
	return (
		<Button className={pill} onClick={action.onClick} variant='secondary'>
			{action.icon ? <Icon aria-hidden className={action.iconClassName} icon={action.icon} size='sm' /> : <span aria-hidden className={`size-2 rounded-full ${action.dotClassName ?? ''}`} />}
			<Button.Text className='text-xs'>{action.label}</Button.Text>
		</Button>
	);
}

/** "3 selected" plus the actions that apply to the selection (one request per item: there is no batch endpoint). */
export function BulkBar({ actions, clearLabel, countLabel, moreLabel, onClear, trailing }: BulkBarProps) {
	return (
		<div className='flex min-w-0 flex-wrap items-center gap-2'>
			<span className='mr-2 text-sm font-medium tabular-nums'>{countLabel}</span>
			{actions.map(action => (
				<ActionButton action={action} key={action.key} />
			))}
			<Separator className='mx-1 hidden h-6 sm:block' orientation='vertical' />
			<ActionButton action={trailing} />
			<Dropdown>
				<Dropdown.Trigger>
					<Button className={pill} variant='secondary'>
						<Button.Text className='text-xs'>{moreLabel}</Button.Text>
						<Button.Icon icon={ChevronDown} />
					</Button>
				</Dropdown.Trigger>
				<Dropdown.Content align='start'>
					<Dropdown.Item onSelect={onClear}>
						<X aria-hidden className='size-4' />
						{clearLabel}
					</Dropdown.Item>
				</Dropdown.Content>
			</Dropdown>
		</div>
	);
}
