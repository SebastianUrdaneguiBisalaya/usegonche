import { Lock } from 'lucide-react';
import { useMemo } from 'react';
import { Navigate, Link as RouterLink, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Form } from '~/components/ui/forms-inputs/form/form';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { InputOtp } from '~/components/ui/forms-inputs/input-otp/input-otp';
import { Link } from '~/components/ui/foundations/link/link';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { useTranslate } from '~/hooks/use-translate';
import { useResetPassword } from './api';
import { authMeta } from './meta';
import { createResetPasswordSchema, OTP_LENGTH } from './schemas';
import { authStyles } from './styles';

export const meta = authMeta('resetPassword');

export default function ResetPasswordPage() {
	const t = useTranslate();
	const [searchParams] = useSearchParams();
	const email = searchParams.get('email');
	const navigate = useNavigate();
	const resetPassword = useResetPassword();
	const schema = useMemo(() => createResetPasswordSchema(t), [t]);

	if (!email) return <Navigate replace to='/auth/forgot-password' />;

	return (
		<>
			<Layout.Stack className='w-full' gap='sm'>
				<Typography.H2 className={authStyles.title}>{t('auth.resetPassword.title')}</Typography.H2>
				<Typography.Span className={authStyles.subtitle}>
					{t('auth.resetPassword.description', {
						email,
					})}
				</Typography.Span>
			</Layout.Stack>
			<Form
				className='w-full'
				defaultValues={{
					code: '',
					confirm_password: '',
					password: '',
				}}
				mode='onSubmit'
				onSubmit={data =>
					resetPassword.mutate(
						{
							email,
							password: data.password,
							token: data.code,
						},
						{
							onSuccess: () => {
								toast.success(t('auth.resetPassword.success'));
								void navigate('/', {
									replace: true,
								});
							},
						}
					)
				}
				schema={schema}
			>
				{({ Field }) => (
					<Layout.Stack>
						<Field name='code'>{field => <InputOtp errorMessage={field.error} label={t('auth.resetPassword.code.label')} length={OTP_LENGTH} {...field.changeProps} />}</Field>
						<Field name='password'>
							{field => (
								<Input className={authStyles.input} errorMessage={field.error}>
									<Input.Icon icon={Lock} />
									<Input.Field
										aria-label={t('auth.resetPassword.newPassword.label')}
										autoComplete='off'
										placeholder={t('auth.resetPassword.newPassword.placeholder')}
										type='password'
										{...field.inputProps}
									/>
									<Input.PasswordToggle hideLabel={t('auth.common.password.hide')} showLabel={t('auth.common.password.show')} />
								</Input>
							)}
						</Field>
						<Field name='confirm_password'>
							{field => (
								<Input className={authStyles.input} errorMessage={field.error}>
									<Input.Icon icon={Lock} />
									<Input.Field
										aria-label={t('auth.resetPassword.confirmPassword.label')}
										autoComplete='off'
										placeholder={t('auth.resetPassword.confirmPassword.placeholder')}
										type='password'
										{...field.inputProps}
									/>
									<Input.PasswordToggle hideLabel={t('auth.common.password.hide')} showLabel={t('auth.common.password.show')} />
								</Input>
							)}
						</Field>
						<Form.Submit
							className={authStyles.primary}
							loading={resetPassword.isPending}
							lang={{
								loadingText: t('auth.resetPassword.submitting'),
							}}
						>
							<Button.Text className={authStyles.primaryText}>{t('auth.resetPassword.submit')}</Button.Text>
						</Form.Submit>
					</Layout.Stack>
				)}
			</Form>
			<Link as={RouterLink} className='self-center' to='/auth/sign-in'>
				{t('auth.common.backToSignIn')}
			</Link>
		</>
	);
}
