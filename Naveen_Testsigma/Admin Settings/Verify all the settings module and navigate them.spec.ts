/**
 * Navigating every tab of Admin Settings and checking what each one shows.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open Settings and check the Admin Settings heading and its 21 tabs, in order, from "Integrations" to
 *   "Plans & Billing".
 * - Open each tab in turn, check its address, give it time to finish loading, and check the elements it shows:
 *   titles and descriptions, buttons, search boxes, filters, toggles, options, links, column headings and the
 *   table or empty state under them.
 *
 * Only looks at the pages: nothing is clicked apart from the tabs themselves, so no setting is changed. What the
 * account holds (users, labels, exports and so on) changes over time, so tables are checked by their column
 * headings rather than their rows, and counts such as "All (9)" by their pattern rather than their number.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectTabElements, openSettings, openSignedInSettings, openTab, settingsTab, tabs } from '../support/admin-settings';

test.describe('Verify all the settings module and navigate them', () => {
	// The tabs are visited in order on one signed-in page, but unlike a serial run, a tab that fails does not stop
	// the tabs after it from being checked.
	test.describe.configure({ mode: 'default', timeout: 120000 });
	test.skip(!process.env.TESTSIGMA_EMAIL || !process.env.TESTSIGMA_PASSWORD, 'Set TESTSIGMA_EMAIL and TESTSIGMA_PASSWORD in .env to run this test.');

	let page: Page;
	let main: Locator;

	test.beforeAll(async ({ browser }) => {
		page = await openSignedInSettings(browser);
		main = page.locator('main');
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('Open Settings and check the Admin Settings tabs', async () => {
		await openSettings(page);
		for (const tab of tabs) {
			await expect(settingsTab(main, tab.name)).toBeVisible();
		}
		// The tabs come first in the page, in this order.
		const shown = (await main.getByRole('button').allInnerTexts()).map((text) => text.trim()).slice(0, tabs.length);
		expect(shown).toEqual(tabs.map((tab) => tab.name));
	});

	for (const tab of tabs) {
		test(`${tab.name} tab`, async () => {
			await openTab(page, tab);
			await expectTabElements(main, tab);
			// The tab list stays in place on every tab.
			await expect(settingsTab(main, tabs[0].name)).toBeVisible();
			await expect(settingsTab(main, tabs[tabs.length - 1].name)).toBeVisible();
		});
	}
});
