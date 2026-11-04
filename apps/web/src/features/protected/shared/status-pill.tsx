import type { LucideIcon } from 'lucide-react';
import { Pill } from '~/components/ui/data-display/pill/pill';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Dropdown } from '~/components/ui/overlays-feedback/dropdown/dropdown';
import { cn } from '~/components/ui/utils/tailwind/cn';

/** How a status looks: its label plus a colored dot, or an icon. */
export interface StatusLook {
	/** Class of the dot (a background color). Ignored when there is an icon. */
	dotClassName?: string;
	icon?: LucideIcon;
	/** Class of the icon (a text color). */
	iconClassName?: string;
	label: string;
}

/** The status as a pill. */
export function StatusBadge({ look }: { look: StatusLook }) {
	return (
		<Pill className='gap-2 border-border bg-foreground/[0.05] px-3 py-1.5 text-sm'>
			{look.icon ? <Icon aria-hidden className={look.iconClassName} icon={look.icon} size='sm' /> : <Pill.Dot className={look.dotClassName} />}
			<Pill.Text>{look.label}</Pill.Text>
		</Pill>
	);
}

interface StatusMenuProps<T extends string> {
	ariaLabel: string;
	/** What is shown now (it may be a status that is not an option, like "archived"). */
	current: StatusLook;
	onChange: (value: T) => void;
	options: readonly (StatusLook & { value: T })[];
	/** Shows the pill without the menu. */
	readOnly?: boolean;
	/** Value of the option that is selected now. */
	selected: T | undefined;
}

/** The status pill as a menu: a quick change between the options. */
export function StatusMenu<T extends string>({ ariaLabel, current, onChange, options, readOnly, selected }: StatusMenuProps<T>) {
	if (readOnly) return <StatusBadge look={current} />;

	return (
		<Dropdown>
			<Dropdown.Trigger>
				<button aria-label={ariaLabel} className='cursor-pointer rounded-full transition-opacity hover:opacity-80' title={ariaLabel} type='button'>
					<StatusBadge look={current} />
				</button>
			</Dropdown.Trigger>
			<Dropdown.Content align='start'>
				{options.map(option => (
					<Dropdown.Item key={option.value} onSelect={() => option.value !== selected && onChange(option.value)}>
						{option.icon ? (
							<Icon aria-hidden className={option.iconClassName} icon={option.icon} size='sm' />
						) : (
							<span aria-hidden className={cn('size-2 rounded-full', option.dotClassName ?? '')} />
						)}
						{option.label}
					</Dropdown.Item>
				))}
			</Dropdown.Content>
		</Dropdown>
	);
}
