/**
 * The Tunnels tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Tunnels tab and check its elements.
 * - Check every tunnel listed: its name, host names, owner, client version and state.
 * - Search the tunnels, for one that exists and one that does not, and clear the search.
 * - Show only active tunnels, then only inactive ones, then all of them.
 * - Check the sort options and that "Z to A" and "A to Z" put the tunnels in order.
 * - Check "What is a Tunnel?" explains itself, and "Download Tunnel" offers the tunnel client for every system.
 * - Refresh the list.
 *
 * Only looks: the download links are checked for where they lead rather than followed. The tunnels belong to the
 * account, so they are read from the page.
 */
import { expect, test, type Locator } from '@playwright/test';
import { expectMenuOptions, expectTabElements, openTab, reopenTab, searchAttemptTime, searchFor, searchTime, useSettingsTab } from '../../support/admin-settings';
import { byName, noResults } from '../../support/common';

const client = 'https://static-assets.testsigma.com/testsigma-tunnel-client/latest';

// The tunnel client for each system, for both processor types.
const downloads = [
	{ system: 'Mac', amd64: `${client}/TestsigmaTunnel-macos-amd64.zip`, arm64: `${client}/TestsigmaTunnel-macos-arm64.zip` },
	{ system: 'Windows', amd64: `${client}/TestsigmaTunnel-windows-amd64.zip`, arm64: `${client}/TestsigmaTunnel-windows-arm64.zip` },
	{ system: 'Linux', amd64: `${client}/TestsigmaTunnel-linux-amd64.zip`, arm64: `${client}/TestsigmaTunnel-linux-arm64.zip` },
	// Debian and RPM packages carry the client's version in their names.
	{ system: 'Debian', amd64: new RegExp(`^${client}/testsigma-tunnel_[\\d.]+_amd64\\.deb$`), arm64: new RegExp(`^${client}/testsigma-tunnel_[\\d.]+_arm64\\.deb$`) },
	{ system: 'RPM', amd64: new RegExp(`^${client}/testsigma-tunnel-[\\d.]+-1\\.x86_64\\.rpm$`), arm64: new RegExp(`^${client}/testsigma-tunnel-[\\d.]+-1\\.arm64\\.rpm$`) },
];

// Each tunnel is a row of the grid, e.g. "prod prod-8203 TS0000248.local 1 P Production Test 2.0.6 Active".
function tunnelRows(main: Locator) {
	return main.getByRole('grid').getByRole('row');
}

async function tunnelNames(main: Locator) {
	return Promise.all((await tunnelRows(main).all()).map(async (row) => (await row.innerText()).trim().split(/\s+/)[0]));
}

async function tunnelStates(main: Locator) {
	return Promise.all((await tunnelRows(main).all()).map(async (row) => (await row.innerText()).trim().split(/\s+/).pop()));
}

test.describe('Verify the Tunnels', () => {
	const run = useSettingsTab('Tunnels');

	// The sort options stay open after one is chosen, so open them only when they are not showing.
	async function sortBy(option: string) {
		const choice = run.main.getByText(option, { exact: true });
		if (!(await choice.isVisible())) {
			await run.main.getByText('Sort by', { exact: true }).click();
		}
		await choice.click();
	}

	test('Open the Tunnels tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
	});

	test('Check every tunnel listed', async () => {
		const rows = tunnelRows(run.main);
		const count = await rows.count();
		test.info().annotations.push({ type: 'tunnels', description: `${count} tunnels` });
		test.skip(count === 0, 'The account has no tunnels.');
		for (let index = 0; index < count; index += 1) {
			const text = (await rows.nth(index).innerText()).replace(/\s+/g, ' ').trim();
			// Name, tunnel host name and client host name first; the client version and state last.
			expect.soft(text, `tunnel ${index + 1}`).toMatch(/^\S+ \S+ \S+ .+ \d+\.\d+\.\d+ (Active|Inactive)$/);
			test.info().annotations.push({ type: 'tunnel', description: text });
		}
	});

	test('Search the tunnels', async () => {
		const search = run.main.getByRole('textbox', { name: 'Search', exact: true });
		const all = await tunnelNames(run.main);
		test.skip(all.length === 0, 'The account has no tunnels.');
		const [first] = all;
		await searchFor(search, first, async () => {
			await expect.poll(() => tunnelNames(run.main), { timeout: searchAttemptTime }).toEqual(all.filter((name) => name.toLowerCase().includes(first.toLowerCase())));
		});
		await search.fill('zz-no-such-tunnel');
		await expect(run.main.getByText(noResults, { exact: true })).toBeVisible({ timeout: searchTime });
		await expect(run.main.getByRole('img', { name: 'Empty state illustration' })).toBeVisible();
		await search.clear();
		await expect.poll(() => tunnelNames(run.main), { timeout: searchTime }).toEqual(all);
	});

	test('Show active, inactive and all tunnels', async () => {
		const all = await tunnelNames(run.main);
		await run.main.getByRole('button', { name: 'Active', exact: true }).click();
		await expect.poll(async () => (await tunnelStates(run.main)).every((state) => state === 'Active'), { timeout: searchTime }).toBe(true);
		await run.main.getByRole('button', { name: 'Inactive', exact: true }).click();
		const noInactive = run.main.getByText('No Inactive tunnels Found', { exact: true });
		// Wait for the list to change: either only inactive tunnels, or none at all.
		await expect.poll(async () => (await noInactive.isVisible())
			|| (await tunnelStates(run.main)).every((state) => state === 'Inactive'), { message: 'only inactive tunnels', timeout: searchTime }).toBe(true);
		if (await noInactive.isVisible()) {
			await expect(run.main.getByRole('img', { name: 'Empty state illustration' })).toBeVisible();
			await expect(tunnelRows(run.main)).toHaveCount(0);
		}
		await run.main.getByRole('button', { name: 'All', exact: true }).click();
		await expect.poll(() => tunnelNames(run.main), { timeout: searchTime }).toEqual(all);
	});

	test('Sort the tunnels', async () => {
		await expectMenuOptions(run.main, () => run.main.getByText('Sort by', { exact: true }).click(), ['Name', 'A to Z', 'Z to A']);
		const names = await tunnelNames(run.main);
		await sortBy('Z to A');
		await expect.poll(() => tunnelNames(run.main)).toEqual([...names].sort(byName).reverse());
		await sortBy('A to Z');
		await expect.poll(() => tunnelNames(run.main)).toEqual([...names].sort(byName));
		await reopenTab(run.page, run.tab);
	});

	test('"What is a Tunnel?" explains itself', async () => {
		await run.main.getByRole('button', { name: 'What is a Tunnel?' }).click();
		await expect(run.page.getByRole('tooltip', { name: /What is a Tunnel\?/ }).first()).toBeVisible();
	});

	test('"Download Tunnel" offers the client for every system', async () => {
		await reopenTab(run.page, run.tab);
		await run.main.getByRole('button', { name: 'Download Tunnel' }).click();
		const links = run.page.getByRole('link', { name: /^(amd64|arm64)$/ });
		await expect(links.first()).toBeVisible();
		const offered = await links.evaluateAll((anchors) => anchors.map((anchor) => `${anchor.textContent?.trim()} ${(anchor as HTMLAnchorElement).href}`));
		for (const download of downloads) {
			await expect.soft(run.page.getByText(download.system, { exact: true }).last(), download.system).toBeVisible();
			for (const processor of ['amd64', 'arm64'] as const) {
				const expected = download[processor];
				const found = offered.some((link) => {
					const [name, href] = link.split(' ');
					return name === processor && (typeof expected === 'string' ? href === expected : expected.test(href));
				});
				expect.soft(found, `${download.system} ${processor} download`).toBe(true);
			}
		}
		// Five systems, each for both processor types.
		expect(offered).toHaveLength(downloads.length * 2);
		await expect(run.page.getByText('Docker', { exact: true }).last()).toBeVisible();
		await expect(run.page.getByRole('link', { name: '.docs' })).toHaveAttribute('href', 'https://testsigma.com/docs/testsigma-tunnel/setup/#setup-and-installation');
		await run.main.getByRole('heading', { name: 'Tunnels' }).click();
	});

	test('Refresh the list', async () => {
		await reopenTab(run.page, run.tab);
		const before = await tunnelNames(run.main);
		await run.main.getByRole('button', { name: 'Refresh' }).click();
		await expect.poll(() => tunnelNames(run.main), { timeout: searchTime }).toEqual(expect.arrayContaining(before));
	});
});
