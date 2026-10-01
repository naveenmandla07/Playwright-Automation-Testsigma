/**
 * The Audit Logs tab: the account's log of who did what, an entry's details, and the filters panel.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class AuditLogsTab extends SettingsTabPage {
	readonly filtersButton = this.main.getByRole('button', { name: 'Filters', exact: true });
	// Shown once a filter is applied.
	readonly clearAllButton = this.main.getByRole('button', { name: 'Clear All', exact: true });
	// The popup with an entry's details.
	readonly details = this.dialog;

	constructor(page: Page) {
		super(page, 'Audit Logs');
	}

	// An entry's lines: when, event type, action, project, then who did it and what happened.
	async entryLines(row: Locator) {
		return (await row.innerText()).split('\n').map((line) => line.trim()).filter(Boolean);
	}

	// The filters panel, which is not a dialog.
	get filters() {
		return this.page.locator('div')
			.filter({ has: this.page.getByRole('heading', { name: 'Filters' }) })
			.filter({ has: this.page.getByRole('button', { name: 'Apply' }) })
			.last();
	}

	// The panel's heading anywhere on the page, which is gone once the panel closes.
	get filtersHeading() {
		return this.page.getByRole('heading', { name: 'Filters' });
	}

	async openFilters() {
		await this.filtersButton.click();
		await expect(this.filters.getByRole('heading', { name: 'Filters' })).toBeVisible();
	}

	// A filter's choices are folded away until its name is clicked.
	async openSection(name: string) {
		await this.filters.getByText(name, { exact: true }).click();
	}

	// A filter in use shows how many of its choices are picked, the count in an element of its own, e.g.
	// "Event Type (1)".
	filterInUse(name: string, count: number) {
		return this.main.getByText(new RegExp(`^${name}\\s*\\(${count}\\)$`));
	}
}
