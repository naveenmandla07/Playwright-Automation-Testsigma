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
import { expect, test } from '@playwright/test';
import { searchAttemptTime, searchTime } from '../../pages/settings/SettingsPage';
import { ExportsTab } from '../../pages/settings/tabs/ExportsTab';
import { useSettingsTab } from '../../support/admin-settings';

test.describe('Verify the Exports', () => {
	const run = useSettingsTab(ExportsTab);

	test('Open the Exports tab and check its elements', async () => {
		await run.tab.open();
		await run.tab.expectElements();
	});

	test('Check every export listed', async () => {
		const rows = run.tab.rows;
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
		const search = run.tab.search;
		const all = await run.tab.reportNames();
		const [first] = all;
		await run.tab.searchFor(search, first, async () => {
			await expect.poll(() => run.tab.reportNames(), { timeout: searchAttemptTime }).toEqual(all.filter((name) => name.toLowerCase().includes(first.toLowerCase())));
		});
		await search.fill('zz-no-such-export');
		await expect(run.tab.noMatches).toBeVisible({ timeout: searchTime });
		await expect(run.tab.emptyState).toBeVisible();
		await expect(run.tab.rows).toHaveCount(0);
		await search.clear();
		await expect.poll(() => run.tab.reportNames(), { timeout: searchTime }).toEqual(all);
	});

	test('Refresh the list', async () => {
		const before = await run.tab.reportNames();
		await run.tab.refreshButton.click();
		await expect(run.tab.rows.first()).toBeVisible();
		// A new export may have finished meanwhile, but none that were listed go missing.
		const after = await run.tab.reportNames();
		for (const name of before) {
			expect.soft(after, `export ${name} after refreshing`).toContain(name);
		}
	});

	test('An export\'s menu offers to delete its data', async () => {
		const row = run.tab.rows.first();
		await run.tab.openMenu(row);
		await expect(row.getByText('Delete data', { exact: true })).toBeVisible();
		await run.tab.closeMenu();
		await expect(row.getByText('Delete data', { exact: true })).toHaveCount(0);
	});
});
