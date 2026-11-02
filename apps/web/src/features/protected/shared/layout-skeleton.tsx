import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';

const rows = ['inbox', 'today', 'projects', 'goals', 'tasks', 'notes', 'reflect'] as const;

/** Placeholder of the whole protected layout (sidebar + page) while the session is still unknown on the client. */
export function LayoutSkeleton() {
	return (
		<div className='flex h-screen w-full bg-background'>
			<aside className='hidden h-full w-64 shrink-0 flex-col gap-4 border-r border-border px-4 py-4 md:flex'>
				<Skeleton className='gap-0'>
					<Skeleton.Item className='h-8 w-32' />
				</Skeleton>
				<Skeleton.Item className='h-9 w-full rounded-xl' />
				<div className='flex flex-1 flex-col gap-2'>
					{rows.map(row => (
						<Skeleton.Item className='h-9 w-full' key={row} />
					))}
				</div>
				<Skeleton.Item className='h-24 w-full rounded-xl' />
				<div className='flex items-center gap-2.5 border-t border-border pt-3'>
					<Skeleton.Item className='size-8 rounded-full' />
					<Skeleton.Item className='h-4 w-28' />
				</div>
			</aside>
			<main className='flex flex-1 flex-col gap-4 p-6'>
				<Skeleton.Item className='h-8 w-48' />
				<Skeleton.Item className='h-4 w-72' />
			</main>
		</div>
	);
}
