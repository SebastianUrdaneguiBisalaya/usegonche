import type { Metadata } from 'next';
import { Manrope, IBM_Plex_Sans } from 'next/font/google';
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
		<html lang='en' className={`${manrope.variable} ${ibmPlexSans.variable} h-full antialiased`}>
			<body>{children}</body>
		</html>
	);
}
