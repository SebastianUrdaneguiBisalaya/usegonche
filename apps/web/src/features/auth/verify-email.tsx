import { Navigate, useSearchParams } from 'react-router';
import { RouterLink } from '~/components/router-link';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { useTranslate } from '~/hooks/use-translate';
import { authMeta } from './meta';

export const meta = authMeta('verifyEmail');

/** After sign-up (or a sign-in attempt with an unconfirmed email): the API emailed a confirmation link, which opens `GET /auth/callback`. */
export default function VerifyEmailPage() {
	const t = useTranslate();
	const [searchParams] = useSearchParams();
	const email = searchParams.get('email');

	if (!email) return <Navigate replace to='/auth/sign-up' />;

	return (
		<>
			<Layout.Stack className='w-full items-center text-center' gap='sm'>
				<Typography.H2 className='border-none'>{t('auth.verifyEmail.title')}</Typography.H2>
				<Typography.Span className='text-foreground-secondary'>
					{t('auth.verifyEmail.description', {
						email,
					})}
				</Typography.Span>
			</Layout.Stack>
			<RouterLink className='self-center' to='/auth/sign-in'>
				{t('auth.common.backToSignIn')}
			</RouterLink>
		</>
	);
}
