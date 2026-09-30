/**
 * The Exports tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Exports tab and check its elements.
 * - Check every export listed: its report name, who started it and when, its project, application and version,
 *   and its status.
 * - Search the exports, for one that exists and one that does not, and clear the search.
 * - Refresh the list.
 * - Open an export's menu and check it offers "Delete data".
 *
 * Nothing is changed: "Delete data" is checked but never clicked. The exports belong to the account, so they are
 * read from the page and checked for what every export shows.
 */
import { expect, test, type Locator } from '@playwright/test';
import { expectTabElements, openTab, searchFor, useSettingsTab } from '../../support/admin-settings';

// The list is searched on the server, which can take a while to answer.
const searchTime = 15000;
// How long each attempt at a search waits for its results before typing it again.
const searchAttemptTime = 10000;

// Each export is a row inside the grid's own wrapping row.
function exportRows(main: Locator) {
	return main.getByRole('grid').getByRole('row').getByRole('row');
}

async function reportNames(main: Locator) {
	return (await exportRows(main).all()).length
		? Promise.all((await exportRows(main).all()).map(async (row) => (await row.getByRole('gridcell').first().innerText()).trim()))
		: [];
}

test.describe('Verify the Exports', () => {
	const run = useSettingsTab('Exports');

	test('Open the Exports tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
	});

	test('Check every export listed', async () => {
		const rows = exportRows(run.main);
		await expect(rows.first()).toBeVisible();
		const count = await rows.count();
		test.info().annotations.push({ type: 'exports', description: `${count} exports` });
		for (let index = 0; index < count; index += 1) {
			const cells = rows.nth(index).getByRole('gridcell');
			const name = (await cells.nth(0).innerText()).trim();
			// A report is a file, named with its extension.
			expect.soft(name, `report name of export ${index + 1}`).toMatch(/\.\w+$/);
			// Who started the export, and when, e.g. "Production Test Jun 15, 2026, 06:57 PM".
			await expect.soft(cells.nth(1), `initiated by of ${name}`).toHaveText(/\S.*\w{3} \d{1,2}, \d{4}, \d{1,2}:\d{2} (AM|PM)$/);
			await expect.soft(cells.nth(2), `project of ${name}`).toHaveText(/\S/);
			// The application and its version.
			await expect.soft(cells.nth(3), `application of ${name}`).toHaveText(/\S/);
			await expect.soft(cells.nth(4), `status of ${name}`).toHaveText(/\S/);
			test.info().annotations.push({ type: 'export', description: `${name}: ${(await cells.nth(4).innerText()).trim()}` });
		}
	});

	test('Search the exports', async () => {
		const search = run.main.getByRole('textbox', { name: 'Search', exact: true });
		const all = await reportNames(run.main);
		const [first] = all;
		await searchFor(search, first, async () => {
			await expect.poll(() => reportNames(run.main), { timeout: searchAttemptTime }).toEqual(all.filter((name) => name.toLowerCase().includes(first.toLowerCase())));
		});
		await search.fill('zz-no-such-export');
		await expect(run.main.getByText('Oops! No matching Exports were found for the provided search.', { exact: true })).toBeVisible({ timeout: searchTime });
		await expect(run.main.getByRole('img', { name: 'Empty state illustration' })).toBeVisible();
		await expect(exportRows(run.main)).toHaveCount(0);
		await search.clear();
		await expect.poll(() => reportNames(run.main), { timeout: searchTime }).toEqual(all);
	});

	test('Refresh the list', async () => {
		const before = await reportNames(run.main);
		await run.main.getByRole('button', { name: 'Refresh' }).click();
		await expect(exportRows(run.main).first()).toBeVisible();
		// A new export may have finished meanwhile, but none that were listed go missing.
		const after = await reportNames(run.main);
		for (const name of before) {
			expect.soft(after, `export ${name} after refreshing`).toContain(name);
		}
	});

	test('An export\'s menu offers to delete its data', async () => {
		const row = exportRows(run.main).first();
		await row.getByTestId('more-vertical').click();
		await expect(row.getByText('Delete data', { exact: true })).toBeVisible();
		// Close the menu by clicking away from it.
		await run.main.getByText('Report name', { exact: true }).click();
		await expect(row.getByText('Delete data', { exact: true })).toHaveCount(0);
	});
});
