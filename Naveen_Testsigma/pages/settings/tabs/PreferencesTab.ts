/**
 * The Preferences tab: the account-wide preferences, each a title, a description and a switch, and the Copilot &
 * Recorder Extension choices.
 */
import type { Locator, Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class PreferencesTab extends SettingsTabPage {
	// The explanation of who can stop executions, a list inside a paragraph.
	readonly stopExplanation = this.main.getByRole('paragraph').filter({ has: this.page.getByRole('list') });

	constructor(page: Page) {
		super(page, 'Preferences');
	}

	// Each preference is turned on or off by its switch, drawn over the checkbox that names it.
	switchDrawnOver(checkbox: Locator) {
		return checkbox.locator('..').getByTestId('toggle-switch');
	}

	// A recorder extension choice, named by its title and description.
	recorderChoice(name: string, description: string) {
		return this.main.getByRole('radio', { name: `${name} ${description}`, exact: true });
	}
}
