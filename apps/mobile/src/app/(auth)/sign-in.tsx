import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField, type TextFieldRef } from '@/components/text-field';
import { useLogin } from '@/features/auth/api';
import { AuthHeader } from '@/features/auth/auth-header';
import { FormError } from '@/features/auth/form-error';
import { GoogleButton } from '@/features/auth/google-button';
import { createSignInSchema, fieldErrors } from '@/features/auth/schemas';
import { spacing } from '@/theme';

export default function SignIn() {
	const { t } = useTranslation();
	const login = useLogin();
	const passwordRef = useRef<TextFieldRef>(null);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [errors, setErrors] = useState<Record<string, string>>({});

	const submit = () => {
		if (login.isPending) return;
		const parsed = createSignInSchema(t).safeParse({ email, password });
		setErrors(parsed.success ? {} : fieldErrors(parsed.error));
		// On success the session switches the protected routes on: no navigation here.
		if (parsed.success) login.mutate(parsed.data);
	};

	return (
		<Screen>
			<AuthHeader description={t('auth.signIn.description')} title={t('auth.signIn.title')} />
			<View style={styles.form}>
				<TextField
					autoComplete='email'
					error={errors.email}
					keyboardType='email-address'
					label={t('auth.common.email.label')}
					onChangeText={setEmail}
					onSubmitEditing={() => passwordRef.current?.focus()}
					placeholder={t('auth.common.email.placeholder')}
					returnKeyType='next'
					submitBehavior='submit'
					textContentType='emailAddress'
					value={email}
				/>
				<TextField
					autoComplete='current-password'
					error={errors.password}
					label={t('auth.common.password.label')}
					onChangeText={setPassword}
					onSubmitEditing={submit}
					placeholder={t('auth.common.password.placeholder')}
					ref={passwordRef}
					returnKeyType='go'
					secret
					textContentType='password'
					value={password}
				/>
				<Link href='/forgot-password' style={styles.forgot}>
					<Text tone='secondary' variant='label'>
						{t('auth.signIn.forgotPassword')}
					</Text>
				</Link>
				<FormError error={login.error} />
				<Button loading={login.isPending} onPress={submit} title={t('auth.signIn.submit')} />
			</View>
			<GoogleButton title={t('auth.signIn.google')} />
			<View style={styles.footer}>
				<Text tone='secondary' variant='subhead'>
					{t('auth.signIn.noAccount')}
				</Text>
				<Link href='/sign-up'>
					<Text variant='label'>{t('auth.signIn.signUpLink')}</Text>
				</Link>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	footer: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: spacing.xs,
		justifyContent: 'center',
		marginTop: 'auto',
	},
	forgot: {
		alignSelf: 'flex-end',
	},
	form: {
		gap: spacing.lg,
	},
});
