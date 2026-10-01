/**
 * The SMTP Configuration tab: whether mail is sent by Testsigma's server or by the account's own.
 */
import type { Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class SmtpConfigurationTab extends SettingsTabPage {
	readonly testsigmaLogo = this.main.getByRole('img', { name: 'Testsigma logo' }).last();
	readonly ownServerIcon = this.main.getByTestId('alternate-email');
	// SMTP is turned on or off by a switch beside the tab's title.
	readonly smtpSwitch = this.main.getByTestId('toggle-switch');
	readonly smtpDisabled = this.main.getByRole('img', { name: 'SMTP disabled illustration' });
	// The first field of the account's own server's settings.
	readonly ownServer = this.main.getByRole('textbox').first();

	constructor(page: Page) {
		super(page, 'SMTP Configuration');
	}
}
