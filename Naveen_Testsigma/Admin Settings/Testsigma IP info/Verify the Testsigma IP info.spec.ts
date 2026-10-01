/**
 * The Testsigma IP info tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Testsigma IP info tab and check its elements.
 * - Check the current server version.
 * - Check the Testsigma server and lab IP addresses are listed, each a valid address.
 * - Copy each address with its copy icon and check the address copied.
 *
 * Only reads and copies; nothing is changed.
 */
import { expect, test } from '@playwright/test';
import { TestsigmaIpInfoTab } from '../../pages/settings/tabs/TestsigmaIpInfoTab';
import { useSettingsTab } from '../../support/admin-settings';

const ipAddress = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

test.describe('Verify the Testsigma IP info', () => {
	const run = useSettingsTab(TestsigmaIpInfoTab);

	test('Open the Testsigma IP info tab and check its elements', async () => {
		await run.tab.open();
		await run.tab.expectElements();
	});

	test('Check the current server version', async () => {
		await expect(run.tab.paragraph(/^Current Server Version$/)).toBeVisible();
		const version = run.tab.version;
		// e.g. "v9.3.8 - Cloud"
		await expect(version).toHaveText(/^v\d+\.\d+\.\d+ - \w+$/);
		test.info().annotations.push({ type: 'server version', description: (await version.innerText()).trim() });
	});

	for (const heading of ['Testsigma Server IP', 'Testsigma Lab IP']) {
		test(`Check the ${heading} addresses`, async () => {
			await expect(run.tab.paragraph(new RegExp(`^${heading}$`))).toBeVisible();
			const addresses = await run.tab.addressesAfter(heading);
			expect(addresses.length, `${heading} addresses`).toBeGreaterThan(0);
			for (const address of addresses) {
				expect.soft(address, heading).toMatch(ipAddress);
			}
			expect(new Set(addresses).size, `${heading} addresses are all different`).toBe(addresses.length);
			test.info().annotations.push({ type: heading, description: addresses.join(', ') });
		});
	}

	test('Copy each address', async () => {
		await run.page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
		const addresses = [...await run.tab.addressesAfter('Testsigma Server IP'), ...await run.tab.addressesAfter('Testsigma Lab IP')];
		const copies = run.tab.copyIcons;
		await expect(copies).toHaveCount(addresses.length);
		for (const [index, address] of addresses.entries()) {
			await copies.nth(index).click();
			await expect.poll(() => run.tab.clipboard(), { message: `copy ${address}` }).toBe(address);
		}
	});
});
