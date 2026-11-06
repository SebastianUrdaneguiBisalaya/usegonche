import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField, type TextFieldRef } from '@/components/text-field';
import { useResetPassword } from '@/features/auth/api';
import { AuthHeader } from '@/features/auth/auth-header';
import { FormError } from '@/features/auth/form-error';
import { createResetPasswordSchema, fieldErrors, OTP_LENGTH } from '@/features/auth/schemas';
import { spacing } from '@/theme';

/** Step 2 of password recovery: code + new password. On success this device is signed in (the API signs every other session out). */
export default function ResetPassword() {
	const { t } = useTranslation();
	const { email = '' } = useLocalSearchParams<{ email?: string }>();
	const reset = useResetPassword();
	const passwordRef = useRef<TextFieldRef>(null);
	const confirmRef = useRef<TextFieldRef>(null);
	const [token, setToken] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [errors, setErrors] = useState<Record<string, string>>({});

	const submit = () => {
		if (reset.isPending) return;
		const parsed = createResetPasswordSchema(t).safeParse({ confirmPassword, password, token });
		setErrors(parsed.success ? {} : fieldErrors(parsed.error));
		if (parsed.success) reset.mutate({ email, password: parsed.data.password, token: parsed.data.token });
	};

	return (
		<Screen edges={['bottom']}>
			<AuthHeader description={t('auth.resetPassword.description', { email })} title={t('auth.resetPassword.title')} />
			<View style={styles.form}>
				<TextField
					autoComplete='one-time-code'
					error={errors.token}
					keyboardType='number-pad'
					label={t('auth.resetPassword.code.label')}
					maxLength={OTP_LENGTH}
					onChangeText={setToken}
					onSubmitEditing={() => passwordRef.current?.focus()}
					returnKeyType='next'
					submitBehavior='submit'
					textContentType='oneTimeCode'
					value={token}
				/>
				<TextField
					autoComplete='new-password'
					error={errors.password}
					label={t('auth.resetPassword.newPassword.label')}
					onChangeText={setPassword}
					onSubmitEditing={() => confirmRef.current?.focus()}
					placeholder={t('auth.resetPassword.newPassword.placeholder')}
					ref={passwordRef}
					returnKeyType='next'
					secret
					submitBehavior='submit'
					textContentType='newPassword'
					value={password}
				/>
				<TextField
					autoComplete='new-password'
					error={errors.confirmPassword}
					label={t('auth.resetPassword.confirmPassword.label')}
					onChangeText={setConfirmPassword}
					onSubmitEditing={submit}
					placeholder={t('auth.resetPassword.confirmPassword.placeholder')}
					ref={confirmRef}
					returnKeyType='go'
					secret
					textContentType='newPassword'
					value={confirmPassword}
				/>
				<FormError error={reset.error} />
				<Button loading={reset.isPending} onPress={submit} title={reset.isPending ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')} />
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	form: {
		gap: spacing.lg,
	},
});
