import { Pill } from '~/components/ui/data-display/pill/pill';
import { Dropdown } from '~/components/ui/overlays-feedback/dropdown/dropdown';
import { useTranslate } from '~/hooks/use-translate';
import { type DisplayStatus, statusDot } from '../display';
import { type ProjectStatus, projectStatuses } from '../search-params';

/** The status as a pill with its colored dot. */
export function StatusPill({ status }: { status: DisplayStatus }) {
	const t = useTranslate();
	return (
		<Pill className='gap-2 border-border bg-foreground/[0.05] px-3 py-1.5 text-sm'>
			<Pill.Dot className={statusDot[status]} />
			<Pill.Text>{t(`projects.status.${status}`)}</Pill.Text>
		</Pill>
	);
}

interface StatusMenuProps {
	onChange: (status: ProjectStatus) => void;
	status: DisplayStatus;
}

/** The status pill as a menu: a quick change between active, on hold and completed (an archived project is restored first, so it is not editable here). */
export function StatusMenu({ onChange, status }: StatusMenuProps) {
	const t = useTranslate();
	if (status === 'archived') return <StatusPill status={status} />;

	return (
		<Dropdown>
			<Dropdown.Trigger>
				<button aria-label={t('projects.status.change')} className='cursor-pointer rounded-full transition-opacity hover:opacity-80' title={t('projects.status.change')} type='button'>
					<StatusPill status={status} />
				</button>
			</Dropdown.Trigger>
			<Dropdown.Content align='start'>
				{projectStatuses.map(next => (
					<Dropdown.Item key={next} onSelect={() => next !== status && onChange(next)}>
						<span aria-hidden className={`size-2 rounded-full ${statusDot[next]}`} />
						{t(`projects.status.${next}`)}
					</Dropdown.Item>
				))}
			</Dropdown.Content>
		</Dropdown>
	);
}
