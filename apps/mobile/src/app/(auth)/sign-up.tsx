import { Link, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField, type TextFieldRef } from '@/components/text-field';
import { useSignup } from '@/features/auth/api';
import { AuthHeader } from '@/features/auth/auth-header';
import { FormError } from '@/features/auth/form-error';
import { GoogleButton } from '@/features/auth/google-button';
import { createSignUpSchema, fieldErrors } from '@/features/auth/schemas';
import { spacing } from '@/theme';

export default function SignUp() {
	const { t } = useTranslation();
	const router = useRouter();
	const signup = useSignup();
	const emailRef = useRef<TextFieldRef>(null);
	const passwordRef = useRef<TextFieldRef>(null);
	const [displayName, setDisplayName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [errors, setErrors] = useState<Record<string, string>>({});

	const submit = () => {
		if (signup.isPending) return;
		const parsed = createSignUpSchema(t).safeParse({ displayName, email, password });
		setErrors(parsed.success ? {} : fieldErrors(parsed.error));
		if (!parsed.success) return;
		signup.mutate(parsed.data, {
			onSuccess: () => router.push({ params: { email: parsed.data.email }, pathname: '/verify-email' }),
		});
	};

	return (
		<Screen edges={['bottom']}>
			<AuthHeader title={t('auth.signUp.title')} />
			<View style={styles.form}>
				<TextField
					autoCapitalize='words'
					autoComplete='name'
					error={errors.displayName}
					label={t('auth.common.displayName.label')}
					onChangeText={setDisplayName}
					onSubmitEditing={() => emailRef.current?.focus()}
					placeholder={t('auth.common.displayName.placeholder')}
					returnKeyType='next'
					submitBehavior='submit'
					textContentType='name'
					value={displayName}
				/>
				<TextField
					autoComplete='email'
					error={errors.email}
					keyboardType='email-address'
					label={t('auth.common.email.label')}
					onChangeText={setEmail}
					onSubmitEditing={() => passwordRef.current?.focus()}
					placeholder={t('auth.common.email.placeholder')}
					ref={emailRef}
					returnKeyType='next'
					submitBehavior='submit'
					textContentType='emailAddress'
					value={email}
				/>
				<TextField
					autoComplete='new-password'
					error={errors.password}
					label={t('auth.common.password.label')}
					onChangeText={setPassword}
					onSubmitEditing={submit}
					placeholder={t('auth.common.password.placeholder')}
					ref={passwordRef}
					returnKeyType='go'
					secret
					textContentType='newPassword'
					value={password}
				/>
				<FormError error={signup.error} />
				<Button loading={signup.isPending} onPress={submit} title={t('auth.signUp.submit')} />
			</View>
			<GoogleButton title={t('auth.signUp.google')} />
			<View style={styles.footer}>
				<Text tone='secondary' variant='subhead'>
					{t('auth.signUp.haveAccount')}
				</Text>
				<Link dismissTo href='/sign-in'>
					<Text variant='label'>{t('auth.signUp.signInLink')}</Text>
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
	form: {
		gap: spacing.lg,
	},
});
