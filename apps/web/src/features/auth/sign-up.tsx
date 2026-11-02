import { Google } from '@ridemountainpig/svgl-react';
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
			<Typography.H2 className='border-none'>{t('auth.signUp.title')}</Typography.H2>
			<Form
				className='w-full'
				defaultValues={{
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
						<Field name='email'>
							{field => (
								<Input errorMessage={field.error}>
									<Input.Label required>{t('auth.common.email.label')}</Input.Label>
									<Input.Field autoComplete='off' placeholder={t('auth.common.email.placeholder')} {...field.inputProps} />
								</Input>
							)}
						</Field>
						<Field name='password'>
							{field => (
								<Input errorMessage={field.error}>
									<Input.Label required>{t('auth.common.password.label')}</Input.Label>
									<Input.Field autoComplete='off' placeholder={t('auth.common.password.placeholder')} type='password' {...field.inputProps} />
									<Input.PasswordToggle hideLabel={t('auth.common.password.hide')} showLabel={t('auth.common.password.show')} />
								</Input>
							)}
						</Field>
						<Form.Submit
							className='self-center w-full py-3'
							loading={signup.isPending}
							lang={{
								loadingText: t('auth.signUp.submitting'),
							}}
						>
							{t('auth.signUp.submit')}
						</Form.Submit>
					</Layout.Stack>
				)}
			</Form>
			{google.enabled && (
				<>
					<Separator>{t('auth.common.or')}</Separator>
					<Button className='w-full py-3' disabled={google.isPending} onClick={google.signIn} type='button' variant='secondary'>
						<Google height={12} width={12} />
						<Button.Text>{t('auth.signUp.google')}</Button.Text>
					</Button>
				</>
			)}
			<Layout.HStack className='justify-between'>
				<Typography.Span>{t('auth.signUp.haveAccount')}</Typography.Span>
				<Link as={RouterLink} className='text-xs' to='/auth/sign-in'>
					{t('auth.signUp.signInLink')}
				</Link>
			</Layout.HStack>
		</>
	);
}
