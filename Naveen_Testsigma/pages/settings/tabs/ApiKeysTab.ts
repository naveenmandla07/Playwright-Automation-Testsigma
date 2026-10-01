/**
 * The API Keys tab: the account's API keys, and the popup that generates a key or edits one.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class ApiKeysTab extends SettingsTabPage {
	readonly generateButton = this.main.getByRole('button', { name: 'Generate new API Key' });

	constructor(page: Page) {
		super(page, 'API Keys');
	}

	// The popup that generates a key, also used to edit one.
	get form() {
		return this.dialog;
	}

	get keyName() {
		return this.form.getByRole('textbox', { name: 'Key name' });
	}

	get blockParallels() {
		return this.form.getByRole('checkbox', { name: 'Block Parallels' });
	}

	// The switch's label, which takes the click.
	get blockParallelsLabel() {
		return this.form.getByText('Block Parallels', { exact: true });
	}

	get allocateParallels() {
		return this.form.getByRole('spinbutton', { name: 'Allocate parallels' });
	}

	// How many parallels the account has left, e.g. "Account has 5 parallels left".
	get parallelsLeft() {
		return this.form.getByText(/^Account has \d+ parallels? left$/);
	}

	async availableParallels() {
		return Number((await this.parallelsLeft.innerText()).match(/\d+/)![0]);
	}

	get generateKeyButton() {
		return this.form.getByRole('button', { name: 'Generate API Key' });
	}

	get closeButton() {
		return this.form.getByRole('button', { name: 'Close', exact: true });
	}

	get updateButton() {
		return this.form.getByRole('button', { name: 'Update', exact: true });
	}

	expiration(choice: string) {
		return this.form.getByRole('button', { name: choice, exact: true });
	}

	get customDate() {
		return this.form.getByRole('textbox', { name: 'Select expiration date and time' });
	}

	// The key itself, shown masked when a key is edited.
	get keyField() {
		return this.form.getByRole('textbox', { name: 'Key', exact: true });
	}

	formText(text: string | RegExp) {
		return typeof text === 'string' ? this.form.getByText(text, { exact: true }) : this.form.getByText(text);
	}

	// A key's name, in the second cell of its row.
	async keyNameOf(row: Locator) {
		return (await row.getByRole('gridcell').nth(1).innerText()).trim();
	}

	// Each key has a switch for turning it on or off, named after the key.
	keySwitch(row: Locator, name: string) {
		return row.getByRole('checkbox', { name: `common.enable ${name}`, exact: true });
	}

	// A key's own buttons only show while it is hovered.
	rowButton(row: Locator, name: 'Copy API Key' | 'Edit') {
		return name === 'Edit' ? row.getByRole('button', { name, exact: true }) : row.getByRole('button', { name });
	}

	async openGenerateForm() {
		await this.generateButton.click();
		await expect(this.keyName).toBeVisible();
	}

	async closeForm() {
		await this.closeButton.click();
		await expect(this.form).toHaveCount(0);
	}
}
