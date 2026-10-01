/**
 * The User Roles tab: what each role is for, and a row for each entity giving every role's access to it.
 */
import type { Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class UserRolesTab extends SettingsTabPage {
	// Each role's heading has a help icon, in the same order as the roles.
	readonly helpIcons = this.main.getByTestId('help');

	constructor(page: Page) {
		super(page, 'User Roles');
	}

	// The tooltip a help icon shows.
	tooltip(text: string) {
		return this.page.getByRole('tooltip', { name: text }).first();
	}

	// An entity's row, giving each of the five roles' access to it.
	entityRow(entity: string) {
		return this.main.getByRole('row', { name: new RegExp(`^${entity}( (Full|Read only|No access)){5}$`) });
	}
}
