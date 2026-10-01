/**
 * The Labels tab: the account's labels with how many entities each is linked to, their saved filters, selection
 * and editing controls, and the popup listing a label's linked entities.
 */
import type { Locator, Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export type Label = { name: string; linked: number };

export class LabelsTab extends SettingsTabPage {
	readonly addLabelButton = this.main.getByRole('button', { name: 'Add New Label' });
	readonly sortByLabel = this.text('Sort by');
	readonly savedFilters = this.text('Saved Filters');
	readonly deleteButton = this.main.getByRole('button', { name: 'Delete', exact: true });
	readonly clearSelectionButton = this.main.getByRole('button', { name: 'Clear Selection' });
	readonly selectAll = this.main.getByRole('checkbox', { name: 'Select All' });
	// The name box of a label being added or edited.
	readonly nameBox = this.table.getByRole('textbox');
	readonly linkedEntities = new LinkedEntitiesDialog(this.page);

	constructor(page: Page) {
		super(page, 'Labels');
	}

	// The labels listed, in order, with how many entities each is linked to.
	async listedLabels(): Promise<Label[]> {
		const rows = await this.rows.all();
		return Promise.all(rows.map(async (row) => ({
			name: (await row.getByRole('gridcell').first().innerText()).trim(),
			linked: Number((await row.getByRole('gridcell').nth(1).innerText()).trim()),
		})));
	}

	// A label's row, found by its checkbox, which is named after it.
	rowOf(name: string) {
		return this.rows.filter({ has: this.page.getByRole('checkbox', { name, exact: true }) });
	}

	checkboxOf(name: string) {
		return this.rowOf(name).getByRole('checkbox');
	}

	// Hovering a label's row shows its edit and delete icons.
	editIcon(row: Locator) {
		return row.getByTestId('edit-pencil');
	}

	deleteIcon(row: Locator) {
		return row.getByTestId('delete');
	}

	// The sort options stay open after one is chosen, so open them only when they are not showing.
	async sortBy(option: string) {
		const choice = this.text(option);
		if (!(await choice.isVisible())) {
			await this.sortByLabel.click();
		}
		await choice.click();
	}

	// A label's checkbox is drawn over; its parent takes the click.
	async tick(checkbox: Locator) {
		await checkbox.locator('..').click();
	}

	selectAllLabels(total: number) {
		return this.main.getByRole('button', { name: `Select all ${total} Labels` });
	}

	// Opens a label's linked entities from the count in its row.
	async openLinkedEntities(label: Label) {
		await this.rowOf(label.name).getByRole('button', { name: String(label.linked), exact: true }).click();
		return this.linkedEntities;
	}
}

// The popup listing the entities a label is linked to, a tab for each kind.
export class LinkedEntitiesDialog {
	readonly root: Locator;

	constructor(page: Page) {
		this.root = page.getByRole('dialog');
	}

	text(text: string) {
		return this.root.getByText(text, { exact: true });
	}

	// Each kind of entity is a tab showing how many of them use the label, e.g. "Test Plans (1)".
	kindTab(kind: string) {
		return this.root.getByText(new RegExp(`^${kind}\\s*\\(\\d+\\)$`));
	}

	get firstRow() {
		return this.root.getByRole('grid').getByRole('row').first();
	}

	get okayButton() {
		return this.root.getByRole('button', { name: 'Okay' });
	}
}
