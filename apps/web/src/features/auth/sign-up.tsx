import { Google } from '@ridemountainpig/svgl-react';
import { Lock, Mail, User } from 'lucide-react';
import { useMemo } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Form } from '~/components/ui/forms-inputs/form/form';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Link } from '~/components/ui/foundations/link/link';
import { Separator } from '~/components/ui/foundations/separator/separator';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { useTranslate } from '~/hooks/use-translate';
import { useSignup } from './api';
import { authMeta } from './meta';
import { createSignUpSchema } from './schemas';
import { authStyles } from './styles';
import { useGoogleSignIn } from './use-google-sign-in';

export const meta = authMeta('signUp');

export default function SignUpPage() {
	const t = useTranslate();
	const navigate = useNavigate();
	const signup = useSignup();
	const google = useGoogleSignIn();
	const schema = useMemo(() => createSignUpSchema(t), [t]);

	return (
		<>
			<Typography.H2 className={authStyles.title}>{t('auth.signUp.title')}</Typography.H2>
			<Form
				className='w-full'
				defaultValues={{
					displayName: '',
					email: '',
					password: '',
				}}
				mode='onSubmit'
				onSubmit={data =>
					signup.mutate(data, {
						onSuccess: () => {
							void navigate(`/auth/verify-email?email=${encodeURIComponent(data.email)}`);
						},
					})
				}
				schema={schema}
			>
				{({ Field }) => (
					<Layout.Stack>
						<Field name='displayName'>
							{field => (
								<Input className={authStyles.input} errorMessage={field.error}>
									<Input.Icon icon={User} />
									<Input.Field aria-label={t('auth.common.displayName.label')} autoComplete='name' placeholder={t('auth.common.displayName.placeholder')} {...field.inputProps} />
								</Input>
							)}
						</Field>
						<Field name='email'>
							{field => (
								<Input className={authStyles.input} errorMessage={field.error}>
									<Input.Icon icon={Mail} />
									<Input.Field aria-label={t('auth.common.email.label')} autoComplete='off' placeholder={t('auth.common.email.placeholder')} {...field.inputProps} />
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
							loading={signup.isPending}
							lang={{
								loadingText: t('auth.signUp.submitting'),
							}}
						>
							<Button.Text className={authStyles.primaryText}>{t('auth.signUp.submit')}</Button.Text>
						</Form.Submit>
					</Layout.Stack>
				)}
			</Form>
			{google.enabled && (
				<>
					<Separator className={authStyles.separator}>{t('auth.common.or')}</Separator>
					<Button className={authStyles.secondary} disabled={google.isPending} onClick={google.signIn} type='button' variant='secondary'>
						<Google height={16} width={16} />
						<Button.Text className={authStyles.secondaryText}>{t('auth.signUp.google')}</Button.Text>
					</Button>
				</>
			)}
			<Layout.HStack className='justify-center gap-2 text-xs text-foreground-secondary'>
				<Typography.Span className='text-xs text-foreground-secondary'>{t('auth.signUp.haveAccount')}</Typography.Span>
				<Link as={RouterLink} className='text-xs font-medium' to='/auth/sign-in'>
					{t('auth.signUp.signInLink')}
				</Link>
			</Layout.HStack>
		</>
	);
}
