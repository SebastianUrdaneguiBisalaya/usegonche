import { Navigate, useNavigate } from 'react-router';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { useLogout, useSession } from '~/features/auth/api';
import { useTranslate } from '~/hooks/use-translate';

/** Placeholder landing for signed-in users; the Flow Cycle screens replace it. */
export default function HomePage() {
	const t = useTranslate();
	const navigate = useNavigate();
	const { data: user, isPending } = useSession();
	const logout = useLogout();

	if (isPending) return null;
	if (!user) return <Navigate replace to='/auth/sign-in' />;

	return (
		<Layout.Stack className='h-full items-center justify-center'>
			<Typography.H2 className='border-none'>{t('home.welcome', { email: user.email ?? '' })}</Typography.H2>
			<Button disabled={logout.isPending} onClick={() => logout.mutate(undefined, { onSettled: () => void navigate('/auth/sign-in', { replace: true }) })} variant='secondary'>
				<Button.Text>{t('home.signOut')}</Button.Text>
			</Button>
		</Layout.Stack>
	);
}
