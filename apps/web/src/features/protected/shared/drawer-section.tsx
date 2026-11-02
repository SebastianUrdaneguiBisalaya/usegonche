import { Button } from '~/components/ui/actions-controls/button/button';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';

interface DrawerSectionProps<T> {
	empty: string;
	error: boolean;
	errorLabel: string;
	isLoading: boolean;
	items: readonly T[] | undefined;
	onRetry: () => void;
	render: (item: T) => React.ReactNode;
	retryLabel: string;
}

/** One read-only list of a detail drawer: skeleton while loading, an empty state, or a retry on error. */
export function DrawerSection<T extends { id: string }>({ empty, error, errorLabel, isLoading, items, onRetry, render, retryLabel }: DrawerSectionProps<T>) {
	if (isLoading) {
		return (
			<Skeleton className='gap-3'>
				{[0, 1, 2, 3].map(key => (
					<Skeleton.Item className='h-12 w-full rounded-xl' key={key} />
				))}
			</Skeleton>
		);
	}
	if (error) {
		return (
			<Layout.Stack align='center' className='py-10 text-center' gap='sm'>
				<Typography.Span className='text-sm text-muted-foreground'>{errorLabel}</Typography.Span>
				<Button onClick={onRetry} variant='secondary'>
					<Button.Text>{retryLabel}</Button.Text>
				</Button>
			</Layout.Stack>
		);
	}
	if (!items || items.length === 0) return <Typography.Span className='block py-10 text-center text-sm text-muted-foreground'>{empty}</Typography.Span>;
	return (
		<ul className='flex flex-col gap-2'>
			{items.map(item => (
				<li className='flex items-center justify-between gap-3 rounded-xl border border-border bg-foreground/[0.03] px-4 py-3 text-sm' key={item.id}>
					{render(item)}
				</li>
			))}
		</ul>
	);
}
