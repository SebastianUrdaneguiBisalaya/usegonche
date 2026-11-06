import type { Metadata } from 'next';
import { IBM_Plex_Sans, Manrope } from 'next/font/google';
import { NavbarScrollScript } from '@/components/ui/navigation/navbar/navbar-scroll-script';
import { LenisProvider } from '@/providers/lenis';
import './globals.css';

const manrope = Manrope({
	variable: '--font-manrope',
	subsets: ['latin'],
});

const ibmPlexSans = IBM_Plex_Sans({
	variable: '--font-ibm-plex-sans',
	subsets: ['latin'],
});

export const metadata: Metadata = {
	title: 'Gonche - Get Organized, Never Compromise, Hustle Efficiently.',
	description: 'A personal productivity app for a single user: it turns messy work into concrete, executable progress and helps decide what to do, when and how.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
	return (
		// `suppressHydrationWarning`: `NavbarScrollScript` sets `data-navbar-scrolled` on <html> before React hydrates.
		<html lang='en' data-theme='dark' className={`${manrope.variable} ${ibmPlexSans.variable} h-full antialiased`} suppressHydrationWarning>
			<head>
				<NavbarScrollScript />
			</head>
			<body>
				<LenisProvider>{children}</LenisProvider>
			</body>
		</html>
	);
}
