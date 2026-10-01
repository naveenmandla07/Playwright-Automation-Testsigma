/**
 * The Manage Access tab: whether Testsigma support may sign in to the account, with a button to change it.
 */
import type { Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class ManageAccessTab extends SettingsTabPage {
	readonly introduction = this.main.getByRole('paragraph').filter({ hasText: /^To assist with support issues/ });
	readonly status = this.main.getByText(/^Access (Denied|Allowed|Granted)$/);
	readonly allowButton = this.main.getByRole('button', { name: 'Allow Access', exact: true });
	readonly revokeButton = this.main.getByRole('button', { name: /^(Revoke|Deny) Access$/ });

	constructor(page: Page) {
		super(page, 'Manage Access');
	}
}
