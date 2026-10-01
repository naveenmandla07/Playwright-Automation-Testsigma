/**
 * The Exports tab: the reports exported from the account, each with a menu to delete its data.
 */
import type { Locator, Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class ExportsTab extends SettingsTabPage {
	readonly refreshButton = this.main.getByRole('button', { name: 'Refresh' });
	readonly noMatches = this.text('Oops! No matching Exports were found for the provided search.');

	constructor(page: Page) {
		super(page, 'Exports');
	}

	// The report names listed, in order.
	async reportNames() {
		return Promise.all((await this.rows.all()).map(async (row) => (await row.getByRole('gridcell').first().innerText()).trim()));
	}

	// An export's menu, behind its three-dot icon.
	async openMenu(row: Locator) {
		await row.getByTestId('more-vertical').click();
	}

	// Closes an open menu by clicking away from it.
	async closeMenu() {
		await this.text('Report name').click();
	}
}
