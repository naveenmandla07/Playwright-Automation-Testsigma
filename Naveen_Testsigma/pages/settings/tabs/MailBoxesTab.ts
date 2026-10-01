/**
 * The Mail Boxes tab: the account's mailboxes and, beside them, the chosen mailbox with its messages.
 */
import type { Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

// A message is listed by its sender and subject, e.g. "Airmeet 937169 - Your Airmeet verification code", with the
// date it arrived, e.g. "Mar 09, 2026".
export const messageDate = /^\w{3} \d{2}, \d{4}$/;

export class MailBoxesTab extends SettingsTabPage {
	readonly guide = this.link('Click here');
	// The chosen mailbox's incoming-messages switch, drawn over the tab's first checkbox.
	readonly incomingSwitch = this.main.getByTestId('toggle-switch');
	readonly incomingCheckbox = this.main.getByRole('checkbox').first();
	readonly messageDates = this.main.getByText(messageDate);
	// Until a message is opened, nothing on the tab is written in paragraphs; a message's contents are.
	readonly paragraphs = this.main.getByRole('paragraph');

	constructor(page: Page) {
		super(page, 'Mail Boxes');
	}

	// A message is opened from its line in the list, the one holding its date.
	get firstMessage() {
		return this.messageDates.first().locator('xpath=..');
	}
}
