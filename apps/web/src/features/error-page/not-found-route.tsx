import { data } from 'react-router';
import { ErrorPage } from './error-page';

/**
 * Catch-all route for unknown URLs. Without it nothing matches, so the root loader (language, theme) does not run and the page renders in the
 * default language and theme. It answers with a 404 status but renders the page itself (throwing would drop the root data).
 */
export function loader() {
	return data(null, { status: 404 });
}

export default function NotFoundRoute() {
	return <ErrorPage kind='notFound' />;
}
