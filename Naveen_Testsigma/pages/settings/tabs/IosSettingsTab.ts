/**
 * The iOS Settings tab: the provisioning profiles, with the steps that create one, and the Web Driver Agents, with
 * the form that uploads one. Both forms open in the tab itself rather than in a popup.
 */
import type { Locator, Page } from '@playwright/test';
import { escapeRegExp } from '../../../support/common';
import { SettingsTabPage } from '../SettingsPage';

export class IosSettingsTab extends SettingsTabPage {
	readonly createProfileLink = this.text('Create new profile');
	readonly createProfileTitle = this.text('Create New Profile');
	readonly webDriverAgentTab = this.text('Web Driver Agent');
	readonly uploadNewButton = this.main.getByRole('button', { name: 'Upload new' }).first();
	readonly uploadWdaTitle = this.text('Upload new WDA');
	readonly noAgents = this.text('Upload your first Web Driver Agent by clicking the button below.');
	// The name asked for by both forms.
	readonly nameField = this.main.getByRole('textbox', { name: 'Enter name' });
	readonly sampleWda = this.main.getByRole('link', { name: 'Sample WDA' });
	readonly fileInput = this.main.locator('input[type=file]');

	constructor(page: Page) {
		super(page, 'iOS Settings');
	}

	// The first cell of each profile's row, its name.
	async profileNames() {
		return Promise.all((await this.rows.all()).map(async (row) => (await row.getByRole('gridcell').first().innerText()).trim()));
	}

	// A file the profile's row offers for download, in the given column.
	downloadIn(row: Locator, column: number) {
		return row.getByRole('gridcell').nth(column).getByRole('link', { name: 'Download' });
	}

	// A profile's delete icon only shows while it is hovered.
	deleteIcon(row: Locator) {
		return row.getByTestId('delete');
	}

	// A step of creating a profile is headed by its number.
	stepNumber(number: string) {
		return this.main.getByRole('heading', { name: number, exact: true });
	}

	// A paragraph matched whole, by a pattern, or by text it contains.
	paragraph(text: string | RegExp, { whole = false } = {}) {
		return this.main.getByRole('paragraph').filter({ hasText: whole && typeof text === 'string' ? new RegExp(`^${escapeRegExp(text)}$`) : text });
	}

	formButton(name: string) {
		return this.main.getByRole('button', { name, exact: true });
	}
}
