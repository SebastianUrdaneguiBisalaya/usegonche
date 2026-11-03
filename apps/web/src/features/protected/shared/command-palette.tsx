import { useHotkeys } from '@usehotkeys/react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Kbd } from '~/components/ui/foundations/kbd/kbd';
import { Command } from '~/components/ui/navigation/command/command';
import { useTranslate } from '~/hooks/use-translate';
import { useNotesSearch } from '../notes/api';
import { noteIcon, plainSnippet } from '../notes/display';
import { allNav, type NavEntry } from './navigation';
import { shortcutKeys } from './shortcut-keys';

/** Registers the `g` + letter shortcut of one section; unmounting removes it. */
function NavHotkey({ entry }: { entry: NavEntry }) {
	const t = useTranslate();
	const navigate = useNavigate();
	useHotkeys(entry.hotkey, () => void navigate(entry.to), { group: 'navigation', label: t(entry.label) });
	return null;
}

const NOTES_SHOWN = 5;

interface CommandPaletteProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

/**
 * Command palette plus every app-level shortcut. They are all registered through `useHotkeys` (labelled, so they show up in `useBindings`):
 * `mod+k` toggles the palette (⌘K on macOS, Ctrl+K on Windows and Linux) and `g` + a letter jumps to a section.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
	const t = useTranslate();
	const navigate = useNavigate();
	const [query, setQuery] = useState('');
	const [debounced, setDebounced] = useState('');

	// One notes request per pause in typing, not per keystroke.
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(query.trim()), 250);
		return () => clearTimeout(timer);
	}, [query]);
	const notes = useNotesSearch(open ? debounced : '', 1);
	const noteHits = (notes.data?.data ?? []).slice(0, NOTES_SHOWN);

	useHotkeys('mod+k', () => onOpenChange(!open), { group: 'general', ignoreInputs: false, label: t('protected.command.toggle') });

	const results = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return allNav.filter(entry => !needle || t(entry.label).toLowerCase().includes(needle));
	}, [query, t]);

	return (
		<Command
			onOpenChange={next => {
				onOpenChange(next);
				if (!next) setQuery('');
			}}
			open={open}
			shortcut={null}
		>
			{allNav.map(entry => (
				<NavHotkey entry={entry} key={entry.id} />
			))}
			<Command.Content>
				<Command.Search hint={<Kbd>Esc</Kbd>} onValueChange={setQuery} placeholder={t('protected.command.placeholder')} value={query} />
				{results.length === 0 && noteHits.length === 0 ? (
					<Command.Empty>{t('protected.command.empty')}</Command.Empty>
				) : (
					<Command.List>
						<Command.Group>{t('protected.command.navigate')}</Command.Group>
						{results.map(entry => (
							<Command.Item icon={<Icon aria-hidden icon={entry.icon} size='md' />} key={entry.id} onSelect={() => void navigate(entry.to)}>
								<span className='flex items-center justify-between gap-3'>
									<span>{t(entry.label)}</span>
									<Kbd.Group>
										{shortcutKeys(entry.hotkey).map(key => (
											<Kbd key={key}>{key}</Kbd>
										))}
									</Kbd.Group>
								</span>
							</Command.Item>
						))}
						{noteHits.length > 0 && (
							<>
								<Command.Group>{t('protected.command.notes')}</Command.Group>
								{noteHits.map(hit => (
									<Command.Item icon={<Icon aria-hidden icon={noteIcon(hit.id)} size='md' />} key={hit.id} onSelect={() => void navigate(`/notes?note=${hit.id}`)}>
										<span className='flex min-w-0 flex-col'>
											<span className='truncate'>{hit.title}</span>
											<span className='truncate text-xs text-muted-foreground'>{plainSnippet(hit.snippet)}</span>
										</span>
									</Command.Item>
								))}
							</>
						)}
					</Command.List>
				)}
			</Command.Content>
		</Command>
	);
}
