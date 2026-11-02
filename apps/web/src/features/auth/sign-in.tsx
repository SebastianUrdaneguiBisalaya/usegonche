import { Google } from '@ridemountainpig/svgl-react';
import { Lock, Mail } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Form } from '~/components/ui/forms-inputs/form/form';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Link } from '~/components/ui/foundations/link/link';
import { Separator } from '~/components/ui/foundations/separator/separator';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { useTranslate } from '~/hooks/use-translate';
import { ApiError, getApiErrorMessage } from '~/lib/api-error';
import { useLogin } from './api';
import { authMeta } from './meta';
import { createSignInSchema } from './schemas';
import { authStyles } from './styles';
import { useGoogleSignIn } from './use-google-sign-in';

export const meta = authMeta('signIn');

export default function SignInPage() {
	const t = useTranslate();
	const navigate = useNavigate();
	const login = useLogin();
	const [searchParams] = useSearchParams();
	const google = useGoogleSignIn();
	const schema = useMemo(() => createSignInSchema(t), [t]);

	// The API sends the browser back here with `?error=<code>` when Google sign-in or the email link fails.
	const callbackError = searchParams.get('error');
	useEffect(() => {
		if (callbackError) toast.error(getApiErrorMessage(new ApiError(400, callbackError, '')));
	}, [callbackError]);

	return (
		<>
			<Layout.Stack className='w-full' gap='sm'>
				<Typography.H2 className={authStyles.title}>{t('auth.signIn.title')}</Typography.H2>
				<Typography.Span className={authStyles.subtitle}>{t('auth.signIn.description')}</Typography.Span>
			</Layout.Stack>
			<Form
				className='w-full'
				defaultValues={{
					email: '',
					password: '',
				}}
				mode='onSubmit'
				onSubmit={data =>
					login.mutate(data, {
						onError: error => {
							// The global handler already toasts; also offer the "check your inbox" screen.
							if (error instanceof ApiError && error.code === 'email_not_confirmed') void navigate(`/auth/verify-email?email=${encodeURIComponent(data.email)}`);
						},
						onSuccess: () => {
							void navigate('/', {
								replace: true,
							});
						},
					})
				}
				schema={schema}
			>
				{({ Field }) => (
					<Layout.Stack>
						<Field name='email'>
							{field => (
								<Input className={authStyles.input} errorMessage={field.error}>
									<Input.Icon icon={Mail} />
									<Input.Field aria-label={t('auth.common.email.label')} autoComplete='off' autoFocus placeholder={t('auth.common.email.placeholder')} {...field.inputProps} />
								</Input>
							)}
						</Field>
						<Field name='password'>
							{field => (
								<Input className={authStyles.input} errorMessage={field.error}>
									<Input.Icon icon={Lock} />
									<Input.Field
										aria-label={t('auth.common.password.label')}
										autoComplete='off'
										placeholder={t('auth.common.password.placeholder')}
										type='password'
										{...field.inputProps}
									/>
									<Input.PasswordToggle hideLabel={t('auth.common.password.hide')} showLabel={t('auth.common.password.show')} />
								</Input>
							)}
						</Field>
						<Form.Submit
							className={authStyles.primary}
							loading={login.isPending}
							lang={{
								loadingText: t('auth.signIn.submitting'),
							}}
						>
							<Button.Text className={authStyles.primaryText}>{t('auth.signIn.submit')}</Button.Text>
						</Form.Submit>
					</Layout.Stack>
				)}
			</Form>
			{google.enabled && (
				<>
					<Separator className={authStyles.separator}>{t('auth.common.or')}</Separator>
					<Button className={authStyles.secondary} disabled={google.isPending} onClick={google.signIn} type='button' variant='secondary'>
						<Google height={16} width={16} />
						<Button.Text className={authStyles.secondaryText}>{t('auth.signIn.google')}</Button.Text>
					</Button>
				</>
			)}
			<Link as={RouterLink} className='self-center' to='/auth/forgot-password'>
				<Typography.Span className='text-xs text-foreground-secondary'>{t('auth.signIn.forgotPassword')}</Typography.Span>
			</Link>
			<Layout.HStack className='justify-center gap-2 text-xs text-foreground-secondary'>
				<Typography.Span className='text-xs text-foreground-secondary'>{t('auth.signIn.noAccount')}</Typography.Span>
				<Link as={RouterLink} className='text-xs font-medium' to='/auth/sign-up'>
					{t('auth.signIn.signUpLink')}
				</Link>
			</Layout.HStack>
		</>
	);
}
