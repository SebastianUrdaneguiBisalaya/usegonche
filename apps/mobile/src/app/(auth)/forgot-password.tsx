import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useForgotPassword } from '@/features/auth/api';
import { AuthHeader } from '@/features/auth/auth-header';
import { FormError } from '@/features/auth/form-error';
import { createForgotPasswordSchema, fieldErrors } from '@/features/auth/schemas';
import { spacing } from '@/theme';

/** Step 1 of password recovery: emails a one-time code (same answer whether or not the email is registered). */
export default function ForgotPassword() {
	const { t } = useTranslation();
	const router = useRouter();
	const forgot = useForgotPassword();
	const [email, setEmail] = useState('');
	const [errors, setErrors] = useState<Record<string, string>>({});

	const submit = () => {
		if (forgot.isPending) return;
		const parsed = createForgotPasswordSchema(t).safeParse({ email });
		setErrors(parsed.success ? {} : fieldErrors(parsed.error));
		if (!parsed.success) return;
		forgot.mutate(parsed.data, {
			onSuccess: () => router.push({ params: { email: parsed.data.email }, pathname: '/reset-password' }),
		});
	};

	return (
		<Screen edges={['bottom']}>
			<AuthHeader description={t('auth.forgotPassword.description')} title={t('auth.forgotPassword.title')} />
			<View style={styles.form}>
				<TextField
					autoComplete='email'
					error={errors.email}
					keyboardType='email-address'
					label={t('auth.common.email.label')}
					onChangeText={setEmail}
					onSubmitEditing={submit}
					placeholder={t('auth.common.email.placeholder')}
					returnKeyType='send'
					textContentType='emailAddress'
					value={email}
				/>
				<FormError error={forgot.error} />
				<Button loading={forgot.isPending} onPress={submit} title={forgot.isPending ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit')} />
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	form: {
		gap: spacing.lg,
	},
});
