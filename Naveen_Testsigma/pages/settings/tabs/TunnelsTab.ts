/**
 * The Tunnels tab: the account's tunnels, with their search, state filters and sort options, and the help and
 * downloads for the tunnel client.
 */
import type { Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class TunnelsTab extends SettingsTabPage {
	readonly noInactive = this.text('No Inactive tunnels Found');
	readonly sortByMenu = this.text('Sort by');
	readonly whatIsATunnel = this.main.getByRole('button', { name: 'What is a Tunnel?' });
	readonly whatIsATunnelTooltip = this.page.getByRole('tooltip', { name: /What is a Tunnel\?/ }).first();
	readonly downloadButton = this.main.getByRole('button', { name: 'Download Tunnel' });
	// The download links, one for each processor type of each system.
	readonly downloadLinks = this.page.getByRole('link', { name: /^(amd64|arm64)$/ });
	readonly docsLink = this.page.getByRole('link', { name: '.docs' });
	readonly heading = this.main.getByRole('heading', { name: 'Tunnels' });
	readonly refreshButton = this.main.getByRole('button', { name: 'Refresh' });

	constructor(page: Page) {
		super(page, 'Tunnels');
	}

	// Each tunnel is a row of the grid itself, e.g. "prod prod-8203 TS0000248.local 1 P Production Test 2.0.6 Active".
	override get rows() {
		return this.table.getByRole('row');
	}

	// The first word of each tunnel's row, its name.
	async tunnelNames() {
		return Promise.all((await this.rows.all()).map(async (row) => (await row.innerText()).trim().split(/\s+/)[0]));
	}

	// The last word of each tunnel's row, its state.
	async tunnelStates() {
		return Promise.all((await this.rows.all()).map(async (row) => (await row.innerText()).trim().split(/\s+/).pop()));
	}

	// The filter buttons that show all, only active or only inactive tunnels.
	stateFilter(name: 'All' | 'Active' | 'Inactive') {
		return this.main.getByRole('button', { name, exact: true });
	}

	// The sort options stay open after one is chosen, so open them only when they are not showing.
	async sortBy(option: string) {
		const choice = this.text(option);
		if (!(await choice.isVisible())) {
			await this.sortByMenu.click();
		}
		await choice.click();
	}

	// A system's name in the downloads, e.g. "Mac".
	downloadSystem(name: string) {
		return this.page.getByText(name, { exact: true }).last();
	}

	// Each download link's processor type and address, e.g. "amd64 https://...".
	async offeredDownloads() {
		return this.downloadLinks.evaluateAll((anchors) => anchors.map((anchor) => `${anchor.textContent?.trim()} ${(anchor as HTMLAnchorElement).href}`));
	}
}
