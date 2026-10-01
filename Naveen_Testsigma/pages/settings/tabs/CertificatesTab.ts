/**
 * The Certificates tab: the project's client certificates and the form for adding one.
 */
import { expect, type Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class CertificatesTab extends SettingsTabPage {
	readonly noCertificates = this.text('No client certificates registered for this project yet.');
	readonly addButton = this.main.getByRole('button', { name: 'Add certificate' });

	constructor(page: Page) {
		super(page, 'Certificates');
	}

	// The Add certificate form.
	get form() {
		return this.dialog;
	}

	async openForm() {
		await this.addButton.click();
		await expect(this.form.getByText('Add client certificate', { exact: true })).toBeVisible();
	}

	async cancelForm() {
		await this.form.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(this.form).toHaveCount(0);
	}

	formatButton(format: 'CRT + KEY' | 'PFX bundle') {
		return this.form.getByRole('button', { name: format, exact: true });
	}

	// The file types each file field accepts, e.g. ".crt,.pem,.cer".
	async acceptedFiles() {
		return this.form.locator('input[type=file]').evaluateAll((inputs) => inputs.map((input) => input.getAttribute('accept') ?? ''));
	}
}
