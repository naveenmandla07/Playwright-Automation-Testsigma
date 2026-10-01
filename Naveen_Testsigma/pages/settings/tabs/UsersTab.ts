/**
 * The Users tab: the account's users, grouped by status, with a menu for each and the "Add new user" invitation form.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export type User = { name: string; status: string; email: string; allocation: string; roles: string };

export class UsersTab extends SettingsTabPage {
	readonly addUserButton = this.main.getByRole('button', { name: 'Add new user' });
	readonly sortByLabel = this.text('Sort by');
	readonly pendingRequests = this.text('Pending requests');
	readonly allGroup = this.main.getByText(/^All \(\d+\)$/);
	readonly inviteForm = new InviteUserDialog(this.page);

	constructor(page: Page) {
		super(page, 'Users');
	}

	// A group of users, e.g. "Active users (3)", whatever its count.
	group(name: string) {
		return this.main.getByText(new RegExp(`^${name} \\((\\d+)\\)$`));
	}

	// A user's lines: name, then any roles, status, email and parallel allocation.
	async listedUsers(): Promise<User[]> {
		return Promise.all((await this.rows.all()).map(async (row) => {
			const lines = (await row.innerText()).split('\n').map((line) => line.trim()).filter(Boolean);
			const emailAt = lines.findIndex((line) => line.includes('@'));
			return {
				name: lines[0],
				roles: lines.slice(1, emailAt - 1).join(', '),
				status: lines[emailAt - 1],
				email: lines[emailAt],
				allocation: lines[emailAt + 1],
			};
		}));
	}

	userRow(email: string) {
		return this.rows.filter({ hasText: email });
	}

	// A user's menu, behind its three-dot icon.
	async openUserMenu(row: Locator) {
		await row.getByTestId('more-vertical').click();
	}

	// The sort options stay open after one is chosen, so open them only when they are not showing.
	async sortBy(option: string) {
		const choice = this.text(option).last();
		if (!(await choice.isVisible())) {
			await this.sortByLabel.click();
		}
		await choice.click();
	}

	async openInviteForm() {
		await this.addUserButton.click();
		await expect(this.inviteForm.email).toBeVisible();
		return this.inviteForm;
	}
}

// The "Add new user" popup, which invites a user by email.
export class InviteUserDialog {
	readonly root: Locator;

	constructor(page: Page) {
		this.root = page.getByRole('dialog');
	}

	text(text: string | RegExp) {
		return typeof text === 'string' ? this.root.getByText(text, { exact: true }) : this.root.getByText(text);
	}

	get email() {
		return this.root.getByRole('textbox', { name: 'Email' });
	}

	checkbox(name: 'Super Administrator' | 'Account Administrator' | 'Read Only') {
		return this.root.getByRole('checkbox', { name });
	}

	get projectSearch() {
		return this.root.getByRole('textbox', { name: 'Search Project to assign' });
	}

	// Each project to assign is a row inside the grid's own wrapping row, named by its checkbox.
	get projects() {
		return this.root.getByRole('grid').getByRole('row').getByRole('row');
	}

	get sendInvite() {
		return this.root.getByRole('button', { name: 'Send Invite' });
	}

	async cancel() {
		await this.root.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(this.root).toHaveCount(0);
	}
}
