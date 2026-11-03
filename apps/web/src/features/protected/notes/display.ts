import { BookOpen, Code, FileText, ListChecks, type LucideIcon, StickyNote } from 'lucide-react';
import { pickBy } from '../shared/display';

/** Notes have no icon of their own: it is picked from the id, so it stays the same everywhere (like tasks and projects). */
const NOTE_ICONS: readonly LucideIcon[] = [FileText, ListChecks, Code, StickyNote, BookOpen];
export const noteIcon = (id: string): LucideIcon => pickBy(NOTE_ICONS, id, FileText);

/** The search snippet marks the matched words with « and »: plain text for a line of a result. */
export const plainSnippet = (snippet: string): string => snippet.replace(/[«»]/g, '');
