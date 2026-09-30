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
import { expect, test, type Locator } from '@playwright/test';
import { expectTabElements, openTab, useSettingsTab } from '../../support/admin-settings';

const ipAddress = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

// The addresses listed after a heading, up to the next heading or the end.
async function addressesAfter(main: Locator, heading: string) {
	const texts = (await main.getByRole('paragraph').allInnerTexts()).map((text) => text.trim());
	const start = texts.indexOf(heading) + 1;
	const addresses: string[] = [];
	for (const text of texts.slice(start)) {
		if (!/^\d/.test(text)) {
			break;
		}
		addresses.push(text);
	}
	return addresses;
}

test.describe('Verify the Testsigma IP info', () => {
	const run = useSettingsTab('Testsigma IP info');

	test('Open the Testsigma IP info tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
	});

	test('Check the current server version', async () => {
		await expect(run.main.getByRole('paragraph').filter({ hasText: /^Current Server Version$/ })).toBeVisible();
		const version = run.main.getByRole('paragraph').filter({ hasText: /^v\d+\.\d+\.\d+/ });
		// e.g. "v9.3.8 - Cloud"
		await expect(version).toHaveText(/^v\d+\.\d+\.\d+ - \w+$/);
		test.info().annotations.push({ type: 'server version', description: (await version.innerText()).trim() });
	});

	for (const heading of ['Testsigma Server IP', 'Testsigma Lab IP']) {
		test(`Check the ${heading} addresses`, async () => {
			await expect(run.main.getByRole('paragraph').filter({ hasText: new RegExp(`^${heading}$`) })).toBeVisible();
			const addresses = await addressesAfter(run.main, heading);
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
		const addresses = [...await addressesAfter(run.main, 'Testsigma Server IP'), ...await addressesAfter(run.main, 'Testsigma Lab IP')];
		// Each address has a copy icon of its own, in the same order.
		const copies = run.main.getByTestId('content-copy-sm');
		await expect(copies).toHaveCount(addresses.length);
		for (const [index, address] of addresses.entries()) {
			await copies.nth(index).click();
			await expect.poll(() => run.page.evaluate(() => navigator.clipboard.readText()), { message: `copy ${address}` }).toBe(address);
		}
	});
});
