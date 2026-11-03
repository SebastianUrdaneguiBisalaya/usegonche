import { Tag } from '~/components/ui/data-display/tag/tag';

/** Black or white, whichever reads better on a `#rrggbb` background. */
export const readableOn = (hex: string): '#000000' | '#ffffff' => {
	const [r = 0, g = 0, b = 0] = [1, 3, 5]
		.map(start => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
		.map(channel => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#000000' : '#ffffff';
};

interface TagChipProps {
	/** The color the user chose (`#rrggbb`), or `null` when the tag has none (it looks neutral). */
	color: string | null;
	name: string;
}

/** A tag as a chip in the color the user chose. */
export function TagChip({ color, name }: TagChipProps) {
	return (
		<Tag size='sm' style={color ? { backgroundColor: color, color: readableOn(color) } : undefined}>
			<Tag.Text>{name}</Tag.Text>
		</Tag>
	);
}

/** The dot next to a tag name: the chosen color, or an empty ring when the tag has none. */
export function TagDot({ color }: { color: string | null }) {
	return <span aria-hidden className={`size-3 shrink-0 rounded-full ${color ? '' : 'border border-border'}`} style={color ? { backgroundColor: color } : undefined} />;
}
