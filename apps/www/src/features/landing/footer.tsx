import { type FooterGroup, SiteFooter } from '@/components/ui/navigation/footer/footer';
import { SIGN_IN_URL, SIGN_UP_URL } from '@/lib/links';

const groups: FooterGroup[] = [
	{
		heading: 'Product',
		links: [
			{ href: '#features', label: 'Features' },
			{ href: '#how-it-works', label: 'How it works' },
			{ href: '#desktop', label: 'Desktop' },
			{ href: '#faq', label: 'FAQ' },
		],
	},
	{
		heading: 'Account',
		links: [
			{ href: SIGN_IN_URL, label: 'Sign in' },
			{ href: SIGN_UP_URL, label: 'Get started free' },
		],
	},
];

/** Landing footer: the same section links as the navbar, the account links and the gonche watermark. */
export default function LandingFooter() {
	return <SiteFooter brandName='gonche' copyright={`© ${new Date().getFullYear()} gonche. All rights reserved.`} groups={groups} />;
}
