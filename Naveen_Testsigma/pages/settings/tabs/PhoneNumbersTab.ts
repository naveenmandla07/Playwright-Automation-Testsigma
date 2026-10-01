/**
 * The Phone Numbers (TFA) tab: the phone numbers provisioned for two-factor authentication in tests, or how to ask
 * Testsigma support for some.
 */
import type { Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class PhoneNumbersTab extends SettingsTabPage {
	readonly guide = this.link('Click here');
	readonly noNumbers = this.text('There are no Phone Numbers');
	readonly noNumbersIllustration = this.main.getByRole('img', { name: 'messageText illustration' });
	// The chat link opens Testsigma's support chat on the page.
	readonly chatLink = this.link('Chat');
	readonly supportEmail = this.link('support@testsigma.com');

	constructor(page: Page) {
		super(page, 'Phone Numbers (TFA)');
	}
}
