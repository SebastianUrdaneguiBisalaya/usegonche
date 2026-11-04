import { useHotkeys } from '@usehotkeys/react';
import { Plus } from 'lucide-react';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Kbd } from '~/components/ui/foundations/kbd/kbd';
import { Command } from '~/components/ui/navigation/command/command';
import { useTranslate } from '~/hooks/use-translate';

/** Key that opens the quick add of the current page, the same on every page that has one. */
export const QUICK_ADD_HOTKEY = 'c';

const CloseContext = createContext<(() => void) | null>(null);

/** Closes the enclosing `QuickAddDialog`; `null` outside of one. `QuickAdd` calls it once its text is sent. */
export function useCloseQuickAdd(): (() => void) | null {
	return useContext(CloseContext);
}

interface QuickAddDialogProps {
	/** The add bar (`QuickAdd` and whatever goes with it). It is only mounted while the dialog is open, so its text resets on close. */
	children: ReactNode;
	/** Accessible name and tooltip of the round "+" button. */
	label: string;
}

/**
 * The "+" button of a page header plus the command-style dialog it opens, which holds that page's quick add. The `c` key opens it too.
 * Submitting is done from the field (Enter or the round button); the dialog closes once the text was sent.
 */
export function QuickAddDialog({ children, label }: QuickAddDialogProps) {
	const t = useTranslate();
	const [open, setOpen] = useState(false);

	useHotkeys(QUICK_ADD_HOTKEY, () => setOpen(true), { group: 'general', label });

	return (
		<Command onOpenChange={setOpen} open={open} shortcut={null}>
			<Command.Trigger>
				<Button aria-label={label} className='size-9 shrink-0 rounded-full p-0' size='icon' title={label}>
					<Button.Icon icon={Plus} />
				</Button>
			</Command.Trigger>
			<Command.Content>
				<CloseContext.Provider value={() => setOpen(false)}>
					<div className='flex flex-col gap-3 p-3'>
						{children}
						<div className='flex items-center justify-end gap-1.5 px-2 text-xs text-muted-foreground'>
							<span>{t('protected.quickAdd.close')}</span>
							<Kbd>Esc</Kbd>
						</div>
					</div>
				</CloseContext.Provider>
			</Command.Content>
		</Command>
	);
}
