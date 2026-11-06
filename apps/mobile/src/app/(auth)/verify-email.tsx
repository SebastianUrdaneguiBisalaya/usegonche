import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useVerifyEmail } from '@/features/auth/api';
import { AuthHeader } from '@/features/auth/auth-header';
import { FormError } from '@/features/auth/form-error';
import { createVerifyEmailSchema, fieldErrors, OTP_LENGTH } from '@/features/auth/schemas';
import { spacing } from '@/theme';

/** Step 2 of sign-up: the code of the confirmation email activates the account and signs the user in. */
export default function VerifyEmail() {
	const { t } = useTranslation();
	const { email = '' } = useLocalSearchParams<{ email?: string }>();
	const verify = useVerifyEmail();
	const [token, setToken] = useState('');
	const [errors, setErrors] = useState<Record<string, string>>({});

	const submit = () => {
		if (verify.isPending) return;
		const parsed = createVerifyEmailSchema(t).safeParse({ token });
		setErrors(parsed.success ? {} : fieldErrors(parsed.error));
		if (parsed.success) verify.mutate({ email, token: parsed.data.token });
	};

	return (
		<Screen edges={['bottom']}>
			<AuthHeader description={t('mobile.verifyEmail.description', { email })} title={t('auth.verifyEmail.title')} />
			<View style={styles.form}>
				<TextField
					autoComplete='one-time-code'
					error={errors.token}
					keyboardType='number-pad'
					label={t('auth.resetPassword.code.label')}
					maxLength={OTP_LENGTH}
					onChangeText={setToken}
					onSubmitEditing={submit}
					textContentType='oneTimeCode'
					value={token}
				/>
				<FormError error={verify.error} />
				<Button loading={verify.isPending} onPress={submit} title={verify.isPending ? t('mobile.verifyEmail.submitting') : t('mobile.verifyEmail.submit')} />
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	form: {
		gap: spacing.lg,
	},
});
