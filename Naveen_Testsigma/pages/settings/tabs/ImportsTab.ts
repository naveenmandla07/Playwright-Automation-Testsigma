/**
 * The Imports tab: what was imported into the account, each import's summary, the Postman imports and the form
 * for importing a Postman collection.
 */
import type { Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class ImportsTab extends SettingsTabPage {
	readonly postmanImports = this.text('Postman imports');
	readonly importButton = this.main.getByRole('button', { name: 'Import', exact: true });

	constructor(page: Page) {
		super(page, 'Imports');
	}

	// An import's summary, and the Import form, open as popups.
	get summary() {
		return this.dialog;
	}

	get importForm() {
		return this.dialog;
	}
}
