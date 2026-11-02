import type { ComponentProps, MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import { Link } from '~/components/ui/foundations/link/link';

type RouterLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { to: string };

/** The UI library's `Link` (a plain `<a>`) with client-side navigation through React Router. */
export function RouterLink({ onClick, to, ...props }: RouterLinkProps) {
	const navigate = useNavigate();
	const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
		onClick?.(event);
		if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		void navigate(to);
	};
	return <Link href={to} onClick={handleClick} {...props} />;
}
