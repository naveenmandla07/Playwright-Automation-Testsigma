/**
 * The Report Settings tab: the Customise Reports preference.
 */
import type { Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class ReportSettingsTab extends SettingsTabPage {
	readonly description = this.main.getByRole('paragraph').filter({ hasText: /^Export customised reports/ });
	readonly customise = this.switchOf('Customise Reports');

	constructor(page: Page) {
		super(page, 'Report Settings');
	}
}
