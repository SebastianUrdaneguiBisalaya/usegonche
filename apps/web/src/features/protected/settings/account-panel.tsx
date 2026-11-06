import { useMemo } from 'react';
import { toast } from 'sonner';
import { Form } from '~/components/ui/forms-inputs/form/form';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { PhoneInput } from '~/components/ui/forms-inputs/phone-input/phone-input';
import { Layout } from '~/components/ui/layout/layout/layout';
import { SettingsDialog } from '~/components/ui/overlays-feedback/settings-dialog/settings-dialog';
import { useSession } from '~/features/auth/api';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { diffPayload } from '~/utils/diff-payload';
import { listStyles } from '../shared/styles';
import { type UpdateProfileBody, useUpdateProfile, useUserSettings } from './api';
import { AvatarEditor } from './avatar-editor';
import { useFlags } from './general-panel';
import { phoneLabels, toPhoneCountry } from './phone';
import { type AccountValues, BIO_MAX, createAccountSchema, NAME_MAX, URL_MAX } from './schemas';

/** An empty field clears the value on the profile. */
const orNull = (value: string): string | null => value || null;

/** Every profile field except the email, which is shown but cannot be changed. Only what changed is sent (`PATCH /profile`); nothing when nothing did. */
export function AccountPanel() {
	const t = useTranslate();
	const { data: session } = useSession();
	const update = useUpdateProfile();
	const schema = useMemo(() => createAccountSchema(t), [t]);
	const profile = session?.profile;
	const { locale } = useLanguage();
	const flags = useFlags();
	// The country chosen in onboarding preselects the calling code while the number is empty.
	const defaultCountry = toPhoneCountry(useUserSettings().data?.country);

	if (!profile) return null;

	const saved: AccountValues = {
		bio: profile.bio ?? '',
		company: profile.company ?? '',
		displayName: profile.displayName ?? '',
		industry: profile.industry ?? '',
		jobTitle: profile.jobTitle ?? '',
		phoneNumber: profile.phoneNumber ?? '',
		websiteUrl: profile.websiteUrl ?? '',
	};

	return (
		<Form
			className='flex flex-col gap-8'
			defaultValues={saved}
			mode='onSubmit'
			onSubmit={async (values, form) => {
				const changed = diffPayload<AccountValues>(saved, values);
				const keys = Object.keys(changed) as Array<keyof AccountValues>;
				if (keys.length === 0) return;
				const changes: UpdateProfileBody = Object.fromEntries(keys.map(key => [key, orNull(values[key])]));
				await update.mutateAsync(changes);
				form.reset(values);
				toast.success(t('protected.settings.account.saved'));
			}}
			schema={schema}
		>
			<SettingsDialog.Section title={t('protected.settings.account.title')}>
				<div className='flex flex-col gap-6 py-4'>
					<Layout.HStack align='center' gap='md'>
						<AvatarEditor avatarUrl={profile.avatarUrl ?? null} editable={session.avatarEditable} name={profile.displayName ?? profile.email ?? ''} />
						<Layout.Stack gap='xs'>
							<span className='font-primary text-sm font-medium text-foreground'>{profile.displayName || profile.email}</span>
							<span className='font-primary text-sm text-muted-foreground'>
								{t(session.avatarEditable ? 'protected.settings.account.avatar.hint' : 'protected.settings.account.avatar.providerHint')}
							</span>
						</Layout.Stack>
					</Layout.HStack>

					<Input className={listStyles.field}>
						<Input.Label>{t('protected.settings.account.email.label')}</Input.Label>
						<Input.Field aria-describedby='account-email-hint' disabled readOnly value={profile.email ?? ''} />
					</Input>
					<p className='-mt-4 font-primary text-xs text-muted-foreground' id='account-email-hint'>
						{t('protected.settings.account.email.hint')}
					</p>

					<Form.Field name='displayName'>
						{field => (
							<Input className={listStyles.field} errorMessage={field.error} maxLength={NAME_MAX}>
								<Input.Label>{t('protected.settings.account.displayName.label')}</Input.Label>
								<Input.Field autoComplete='name' placeholder={t('protected.settings.account.displayName.placeholder')} {...field.inputProps} />
							</Input>
						)}
					</Form.Field>
					<Form.Field name='phoneNumber'>
						{field => (
							<PhoneInput
								className={listStyles.field}
								defaultCountry={defaultCountry}
								errorMessage={field.error}
								flags={flags}
								labels={phoneLabels[locale]}
								name={field.name}
								onBlur={field.onBlur}
								onChange={value => field.onChange(value ?? '')}
								placeholder={t('protected.settings.account.phoneNumber.placeholder')}
								searchPlaceholder={t('protected.settings.account.phoneNumber.searchCountry')}
								value={field.value}
							>
								<PhoneInput.Label>{t('protected.settings.account.phoneNumber.label')}</PhoneInput.Label>
							</PhoneInput>
						)}
					</Form.Field>
					<Form.Field name='websiteUrl'>
						{field => (
							<Input className={listStyles.field} errorMessage={field.error} maxLength={URL_MAX}>
								<Input.Label>{t('protected.settings.account.websiteUrl.label')}</Input.Label>
								<Input.Field autoComplete='url' placeholder='https://' type='url' {...field.inputProps} />
							</Input>
						)}
					</Form.Field>
					<Layout.Grid cols={{ base: 1, sm: 2 }} gap='md'>
						<Form.Field name='jobTitle'>
							{field => (
								<Input className={listStyles.field} errorMessage={field.error} maxLength={NAME_MAX}>
									<Input.Label>{t('protected.settings.account.jobTitle.label')}</Input.Label>
									<Input.Field autoComplete='organization-title' placeholder={t('protected.settings.account.jobTitle.placeholder')} {...field.inputProps} />
								</Input>
							)}
						</Form.Field>
						<Form.Field name='company'>
							{field => (
								<Input className={listStyles.field} errorMessage={field.error} maxLength={NAME_MAX}>
									<Input.Label>{t('protected.settings.account.company.label')}</Input.Label>
									<Input.Field autoComplete='organization' placeholder={t('protected.settings.account.company.placeholder')} {...field.inputProps} />
								</Input>
							)}
						</Form.Field>
					</Layout.Grid>
					<Form.Field name='industry'>
						{field => (
							<Input className={listStyles.field} errorMessage={field.error} maxLength={NAME_MAX}>
								<Input.Label>{t('protected.settings.account.industry.label')}</Input.Label>
								<Input.Field placeholder={t('protected.settings.account.industry.placeholder')} {...field.inputProps} />
							</Input>
						)}
					</Form.Field>
					<Form.Field name='bio'>
						{field => (
							<Input className={listStyles.field} errorMessage={field.error} maxLength={BIO_MAX}>
								<Input.Label>{t('protected.settings.account.bio.label')}</Input.Label>
								<Input.Textarea placeholder={t('protected.settings.account.bio.placeholder')} rows={4} {...field.inputProps} />
							</Input>
						)}
					</Form.Field>
				</div>
			</SettingsDialog.Section>
			<Layout.HStack justify='end'>
				<Form.Submit>{t('protected.settings.account.save')}</Form.Submit>
			</Layout.HStack>
		</Form>
	);
}
