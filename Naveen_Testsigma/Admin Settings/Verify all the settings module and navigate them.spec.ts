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
import { expect, test } from '@playwright/test';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { tabs } from '../pages/settings/settingsTabs';
import { openSignedInSettings } from '../support/admin-settings';
import { missingCredentials, missingCredentialsMessage } from '../support/testsigma-auth';

test.describe('Verify all the settings module and navigate them', () => {
	// The tabs are visited in order on one signed-in page, but unlike a serial run, a tab that fails does not stop
	// the tabs after it from being checked.
	test.describe.configure({ mode: 'default', timeout: 120000 });
	test.skip(missingCredentials, missingCredentialsMessage);

	let settings: SettingsPage;

	test.beforeAll(async ({ browser }) => {
		// Signing in and opening Settings can take longer than a hook's own 30 seconds.
		test.setTimeout(120000);
		settings = new SettingsPage(await openSignedInSettings(browser));
	});

	test.afterAll(async () => {
		await settings.page.close();
	});

	test('Open Settings and check the Admin Settings tabs', async () => {
		await settings.openSettings();
		for (const tab of tabs) {
			await expect(settings.tabButton(tab.name)).toBeVisible();
		}
		// The tabs come first in the page, in this order.
		expect(await settings.firstButtonNames(tabs.length)).toEqual(tabs.map((tab) => tab.name));
	});

	for (const tab of tabs) {
		test(`${tab.name} tab`, async () => {
			await settings.openTab(tab);
			await settings.expectTabElements(tab);
			// The tab list stays in place on every tab.
			await expect(settings.tabButton(tabs[0].name)).toBeVisible();
			await expect(settings.tabButton(tabs[tabs.length - 1].name)).toBeVisible();
		});
	}
});
