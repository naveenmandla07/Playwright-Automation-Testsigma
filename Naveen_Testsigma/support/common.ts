/**
 * Small helpers the specs share, whatever part of Testsigma they cover.
 */

// Text made safe to put inside a regular expression, matching itself exactly.
export function escapeRegExp(text: string) {
	return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

// Orders names as Testsigma's "A to Z" does: alphabetically, ignoring case.
export function byName(a: string, b: string) {
	return a.localeCompare(b, 'en', { sensitivity: 'base' });
}

// What a list shows when a search or filter matches nothing.
export const noResults = 'No results found for this search criteria';
