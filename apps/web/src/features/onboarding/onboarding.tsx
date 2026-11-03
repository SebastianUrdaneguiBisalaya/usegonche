import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import authBg from '~/assets/bg-auth.webp';
import icon from '~/assets/usegonche-icon.png';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Stepper } from '~/components/ui/data-display/stepper/stepper';
import { CountrySelect } from '~/components/ui/forms-inputs/country-select/country-select';
import { Select } from '~/components/ui/forms-inputs/select/select';
import { Logo } from '~/components/ui/foundations/logo/logo';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Image } from '~/components/ui/media-files/image/image';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { useSession } from '../auth/api';
import { authStyles } from '../auth/styles';
import { useUpdateSettings, useUserSettings } from '../protected/settings/api';
import { useFlags } from '../protected/settings/general-panel';
import { countryForTimezone, timezoneForCountry } from '../protected/settings/timezone';
import { usePreferences } from '../protected/settings/use-preferences';
import { ThemeChoice } from './theme-choice';

const STEPS = ['appearance', 'region', 'finish'] as const;
const themes = ['dark', 'light', 'system'] as const;
const languages = ['system', 'en', 'es'] as const;

/**
 * Mandatory onboarding, shown after sign-up and on every sign-in until it is completed: theme, language, country and time zone.
 * Theme and language save as they are picked; country and time zone when leaving that step; "Get started" marks the onboarding as completed.
 * It cannot be skipped: the signed-in layout sends the user back here while `onboardingCompletedAt` is empty.
 */
export default function OnboardingRoute() {
	const t = useTranslate();
	const session = useSession();
	const settings = useUserSettings();

	if (session.isPending || (session.data && settings.isPending)) {
		return (
			<Shell>
				<Skeleton className='gap-4' label={t('onboarding.progress')}>
					<Skeleton.Item className='h-64 w-full rounded-2xl' />
				</Skeleton>
			</Shell>
		);
	}
	if (!session.data) return <Navigate replace to='/auth/sign-in' />;
	if (settings.data?.onboardingCompletedAt) return <Navigate replace to='/' />;
	return <Wizard initialCountry={settings.data?.country ?? null} initialTimezone={settings.data?.timezone ?? null} />;
}

/** Dark-only full-screen backdrop with the glass card, like the auth screens. */
function Shell({ children }: { children: React.ReactNode }) {
	return (
		<div className='auth-dark relative isolate flex min-h-screen w-full items-center justify-center overflow-y-auto bg-[#050505] px-4 py-10'>
			<Image className='pointer-events-none absolute inset-0 -z-10 size-full opacity-60'>
				<Image.Img alt='' className='size-full object-cover' src={authBg} />
				<Image.Fallback>
					<div className='size-full bg-black' />
				</Image.Fallback>
			</Image>
			<div className='w-full max-w-4xl rounded-[28px] border border-white/10 bg-linear-to-b from-white/[0.07] to-white/2 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl md:p-10'>
				{children}
			</div>
		</div>
	);
}

const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function Wizard({ initialCountry, initialTimezone }: { initialCountry: string | null; initialTimezone: string | null }) {
	const t = useTranslate();
	const navigate = useNavigate();
	const flags = useFlags();
	const { language, locale, setLanguage, setTheme, theme } = usePreferences();
	const update = useUpdateSettings();
	const [step, setStep] = useState(0);
	// The time zone starts as the browser's (confirmable) and the country is guessed from it, unless the account already has them.
	const [timezone, setTimezone] = useState(initialCountry ? (initialTimezone ?? browserTimezone()) : browserTimezone());
	const [country, setCountry] = useState<string | null>(initialCountry ?? countryForTimezone(browserTimezone()) ?? null);
	const fail = (error: unknown) => toast.error(getApiErrorMessage(error));
	const current = STEPS[step] ?? STEPS[0];

	const changeCountry = (code: string) => {
		setCountry(code);
		setTimezone(timezoneForCountry(code) ?? timezone);
	};

	const next = () => {
		if (step === 1 && country) update.mutate({ country, timezone }, { onError: fail, onSuccess: () => setStep(2) });
		else setStep(value => Math.min(value + 1, STEPS.length - 1));
	};
	const finish = () => update.mutate({ onboardingCompleted: true }, { onError: fail, onSuccess: () => void navigate('/', { replace: true }) });

	return (
		<Shell>
			<div className='flex flex-col gap-8'>
				<Stepper className='mx-auto w-full max-w-xl' lang={{ progressLabel: t('onboarding.progress') }} value={step}>
					{STEPS.map((id, index) => (
						<Stepper.Step className='items-start [&>span[aria-hidden]]:mt-3.5' key={id}>
							<div className='flex flex-col items-center gap-2'>
								<Stepper.Indicator className={index === step ? 'border-transparent bg-foreground text-background' : ''} />
								<Stepper.Title className={index === step ? '' : 'font-normal'}>{t(`onboarding.steps.${id}`)}</Stepper.Title>
							</div>
						</Stepper.Step>
					))}
				</Stepper>

				<div className='flex flex-col items-center gap-3 text-center'>
					<div className='flex items-center justify-center gap-2'>
						<Image className='-my-8 size-16 overflow-visible'>
							<Image.Img alt='' className='mix-blend-screen' src={icon} />
						</Image>
						<Logo className='-ml-5' size='lg'>
							<Logo.Text className='font-medium'>gonche</Logo.Text>
						</Logo>
					</div>
					<Typography.H1 className='text-4xl font-light tracking-tight'>{t(`onboarding.${current}.title`)}</Typography.H1>
					<Typography.Span className={authStyles.subtitle}>{t(`onboarding.${current}.subtitle`)}</Typography.Span>
				</div>

				{step === 0 && (
					<div aria-label={t('onboarding.appearance.title')} className='grid gap-4 sm:grid-cols-3' role='radiogroup'>
						{themes.map(value => (
							<ThemeChoice
								description={t(`onboarding.appearance.${value}.description`)}
								key={value}
								label={t(`onboarding.appearance.${value}.label`)}
								onSelect={() => setTheme(value)}
								selected={theme === value}
								value={value}
							/>
						))}
					</div>
				)}

				{step === 1 && (
					<div className='mx-auto flex w-full max-w-md flex-col gap-4'>
						<Select.Root onChange={setLanguage} value={language}>
							<Select.Label>{t('onboarding.region.language')}</Select.Label>
							<Select.Trigger className={authStyles.input}>
								<Select.Value />
							</Select.Trigger>
							<Select.Content>
								<Select.ItemList>
									{languages.map(option => (
										<Select.Item key={option} value={option}>
											{t(`protected.settings.general.language.options.${option}`)}
										</Select.Item>
									))}
								</Select.ItemList>
							</Select.Content>
						</Select.Root>
						<CountrySelect.Root flags={flags} locale={locale} onChange={changeCountry} value={country}>
							<CountrySelect.Trigger aria-label={t('onboarding.region.country')} className={authStyles.input} />
							<CountrySelect.Content width={400} />
						</CountrySelect.Root>
						<div className='flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3'>
							<span className='text-xs text-foreground-secondary'>{t('onboarding.region.timezone')}</span>
							<span className='text-sm'>{timezone}</span>
							<span className='text-xs text-foreground-tertiary'>{t('onboarding.region.timezoneHint')}</span>
						</div>
					</div>
				)}

				{step === 2 && (
					<dl className='mx-auto flex w-full max-w-md flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm'>
						<Row label={t('onboarding.finish.theme')} value={t(`onboarding.appearance.${theme}.label`)} />
						<Row label={t('onboarding.finish.language')} value={t(`protected.settings.general.language.options.${language}`)} />
						<Row label={t('onboarding.finish.country')} value={country ? (new Intl.DisplayNames([locale], { type: 'region' }).of(country) ?? country) : '-'} />
						<Row label={t('onboarding.finish.timezone')} value={timezone} />
					</dl>
				)}

				<div className='flex items-center justify-between border-t border-white/10 pt-6'>
					<Button className='text-foreground-secondary' disabled={step === 0 || update.isPending} onClick={() => setStep(value => Math.max(value - 1, 0))} type='button' variant='ghost'>
						<Button.Icon icon={ArrowLeft} />
						<Button.Text>{t('onboarding.back')}</Button.Text>
					</Button>
					{step < STEPS.length - 1 ? (
						<Button className={`${authStyles.primary} w-auto px-6`} disabled={(step === 1 && !country) || update.isPending} loading={update.isPending} onClick={next} type='button'>
							<Button.Text className={authStyles.primaryText}>{t('onboarding.continue')}</Button.Text>
							<Button.Icon icon={ArrowRight} />
						</Button>
					) : (
						<Button className={`${authStyles.primary} w-auto px-6`} disabled={update.isPending} loading={update.isPending} onClick={finish} type='button'>
							<Button.Text className={authStyles.primaryText}>{t('onboarding.finish.start')}</Button.Text>
							<Button.Icon icon={ArrowRight} />
						</Button>
					)}
				</div>
			</div>
		</Shell>
	);
}

function Row({ label, value }: { label: string; value: string }) {
	return (
		<div className='flex items-center justify-between gap-4'>
			<dt className='text-foreground-secondary'>{label}</dt>
			<dd>{value}</dd>
		</div>
	);
}
