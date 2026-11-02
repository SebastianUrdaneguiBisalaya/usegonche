import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { useSession } from '~/features/auth/api';
import { useTranslate } from '~/hooks/use-translate';

/** Placeholder landing for signed-in users (Today); the Flow Cycle screens replace it. The session guard lives in the protected layout. */
export default function HomePage() {
	const t = useTranslate();
	const { data: user } = useSession();

	return (
		<Layout.Stack className='h-full items-center justify-center'>
			<Typography.H2 className='border-none'>{t('home.welcome', { email: user?.email ?? '' })}</Typography.H2>
		</Layout.Stack>
	);
}
