import { Mail } from 'lucide-react';
import { useMemo } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Form } from '~/components/ui/forms-inputs/form/form';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Link } from '~/components/ui/foundations/link/link';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { useTranslate } from '~/hooks/use-translate';
import { useForgotPassword } from './api';
import { authMeta } from './meta';
import { createForgotPasswordSchema } from './schemas';
import { authStyles } from './styles';

export const meta = authMeta('forgotPassword');

export default function ForgotPasswordPage() {
	const t = useTranslate();
	const navigate = useNavigate();
	const forgotPassword = useForgotPassword();
	const schema = useMemo(() => createForgotPasswordSchema(t), [t]);

	return (
		<>
			<Layout.Stack className='w-full' gap='sm'>
				<Typography.H2 className={authStyles.title}>{t('auth.forgotPassword.title')}</Typography.H2>
				<Typography.Span className={authStyles.subtitle}>{t('auth.forgotPassword.description')}</Typography.Span>
			</Layout.Stack>
			<Form
				className='w-full'
				defaultValues={{
					email: '',
				}}
				mode='onSubmit'
				onSubmit={data =>
					forgotPassword.mutate(data, {
						onSuccess: () => {
							void navigate(`/auth/reset-password?email=${encodeURIComponent(data.email)}`);
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
						<Form.Submit
							className={authStyles.primary}
							loading={forgotPassword.isPending}
							lang={{
								loadingText: t('auth.forgotPassword.submitting'),
							}}
						>
							<Button.Text className={authStyles.primaryText}>{t('auth.forgotPassword.submit')}</Button.Text>
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
