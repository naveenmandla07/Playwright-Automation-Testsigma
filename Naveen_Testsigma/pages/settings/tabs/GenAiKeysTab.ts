/**
 * The Gen AI Keys tab: the account's own keys for AI providers, the model each AI feature uses, and the popup that
 * creates a key.
 */
import { expect, type Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class GenAiKeysTab extends SettingsTabPage {
	// The help icon beside the title links to the documentation.
	readonly docsLink = this.main.getByRole('link').filter({ has: this.page.locator('svg') }).first();

	constructor(page: Page) {
		super(page, 'Gen AI Keys');
	}

	// A feature's key and model dropdowns, beside its name.
	featureChoices(feature: string) {
		const row = this.text(feature).locator('xpath=..');
		return { key: row.locator('[data-isopen]').nth(0), model: row.locator('[data-isopen]').nth(1) };
	}

	// The popup that creates a key.
	get form() {
		return this.dialog;
	}

	formText(text: string | RegExp) {
		return typeof text === 'string' ? this.form.getByText(text, { exact: true }) : this.form.getByText(text);
	}

	get keyName() {
		return this.form.getByRole('textbox', { name: 'Key Name' });
	}

	get description() {
		return this.form.getByRole('textbox', { name: 'Description' });
	}

	field(name: string) {
		return this.form.getByRole('textbox', { name, exact: true });
	}

	formButton(name: string) {
		return this.form.getByRole('button', { name, exact: true });
	}

	get createButton() {
		return this.formButton('Create');
	}

	get providerMenu() {
		return this.formText('Select provider');
	}

	providerLogo(name: string) {
		return this.form.getByRole('img', { name: `${name} logo` });
	}

	// "Validate API key" is text rather than a button, greyed out and ignoring clicks while it cannot be used.
	get validateKey() {
		return this.formText('Validate API key');
	}

	async openKeyForm() {
		await this.text('Create new key').click();
		await expect(this.keyName).toBeVisible();
	}

	async chooseProvider(name: string) {
		await this.providerMenu.click();
		await this.formText(name).click();
		await expect(this.providerLogo(name)).toBeVisible();
		await expect(this.providerMenu).toHaveCount(0);
	}

	async cancelForm() {
		await this.formButton('Cancel').click();
		await expect(this.form).toHaveCount(0);
	}
}
