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
import { expect, test } from '@playwright/test';
import { searchAttemptTime, searchTime } from '../../pages/settings/SettingsPage';
import { TunnelsTab } from '../../pages/settings/tabs/TunnelsTab';
import { useSettingsTab } from '../../support/admin-settings';
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

test.describe('Verify the Tunnels', () => {
	const run = useSettingsTab(TunnelsTab);

	test('Open the Tunnels tab and check its elements', async () => {
		await run.tab.open();
		await run.tab.expectElements();
	});

	test('Check every tunnel listed', async () => {
		const rows = run.tab.rows;
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
		const search = run.tab.search;
		const all = await run.tab.tunnelNames();
		test.skip(all.length === 0, 'The account has no tunnels.');
		const [first] = all;
		await run.tab.searchFor(search, first, async () => {
			await expect.poll(() => run.tab.tunnelNames(), { timeout: searchAttemptTime }).toEqual(all.filter((name) => name.toLowerCase().includes(first.toLowerCase())));
		});
		await search.fill('zz-no-such-tunnel');
		await expect(run.tab.text(noResults)).toBeVisible({ timeout: searchTime });
		await expect(run.tab.emptyState).toBeVisible();
		await search.clear();
		await expect.poll(() => run.tab.tunnelNames(), { timeout: searchTime }).toEqual(all);
	});

	test('Show active, inactive and all tunnels', async () => {
		const all = await run.tab.tunnelNames();
		await run.tab.stateFilter('Active').click();
		await expect.poll(async () => (await run.tab.tunnelStates()).every((state) => state === 'Active'), { timeout: searchTime }).toBe(true);
		await run.tab.stateFilter('Inactive').click();
		const noInactive = run.tab.noInactive;
		// Wait for the list to change: either only inactive tunnels, or none at all.
		await expect.poll(async () => (await noInactive.isVisible())
			|| (await run.tab.tunnelStates()).every((state) => state === 'Inactive'), { message: 'only inactive tunnels', timeout: searchTime }).toBe(true);
		if (await noInactive.isVisible()) {
			await expect(run.tab.emptyState).toBeVisible();
			await expect(run.tab.rows).toHaveCount(0);
		}
		await run.tab.stateFilter('All').click();
		await expect.poll(() => run.tab.tunnelNames(), { timeout: searchTime }).toEqual(all);
	});

	test('Sort the tunnels', async () => {
		await run.tab.expectMenuOptions(() => run.tab.sortByMenu.click(), ['Name', 'A to Z', 'Z to A']);
		const names = await run.tab.tunnelNames();
		await run.tab.sortBy('Z to A');
		await expect.poll(() => run.tab.tunnelNames()).toEqual([...names].sort(byName).reverse());
		await run.tab.sortBy('A to Z');
		await expect.poll(() => run.tab.tunnelNames()).toEqual([...names].sort(byName));
		await run.tab.reopen();
	});

	test('"What is a Tunnel?" explains itself', async () => {
		await run.tab.whatIsATunnel.click();
		await expect(run.tab.whatIsATunnelTooltip).toBeVisible();
	});

	test('"Download Tunnel" offers the client for every system', async () => {
		await run.tab.reopen();
		await run.tab.downloadButton.click();
		await expect(run.tab.downloadLinks.first()).toBeVisible();
		const offered = await run.tab.offeredDownloads();
		for (const download of downloads) {
			await expect.soft(run.tab.downloadSystem(download.system), download.system).toBeVisible();
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
		await expect(run.tab.downloadSystem('Docker')).toBeVisible();
		await expect(run.tab.docsLink).toHaveAttribute('href', 'https://testsigma.com/docs/testsigma-tunnel/setup/#setup-and-installation');
		await run.tab.heading.click();
	});

	test('Refresh the list', async () => {
		await run.tab.reopen();
		const before = await run.tab.tunnelNames();
		await run.tab.refreshButton.click();
		await expect.poll(() => run.tab.tunnelNames(), { timeout: searchTime }).toEqual(expect.arrayContaining(before));
	});
});
