/**
 * The Custom Fields tab: the test cases' own fields, and the popup that adds or edits one.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class CustomFieldsTab extends SettingsTabPage {
	readonly addButton = this.main.getByRole('button', { name: 'Add new field' });

	constructor(page: Page) {
		super(page, 'Custom Fields');
	}

	// The fields' count beside the heading, e.g. "Test Case (3)".
	fieldCount(count: number) {
		return this.text(new RegExp(`^Test Case\\s*\\(${count}\\)$`));
	}

	// Each field's name and type, as listed.
	async listedFields() {
		return Promise.all((await this.rows.all()).map(async (row) => {
			const cells = row.getByRole('gridcell');
			return { name: (await cells.nth(0).innerText()).trim(), type: (await cells.nth(1).innerText()).trim() };
		}));
	}

	// A field's own icons only show while it is hovered.
	editIcon(row: Locator) {
		return row.getByTestId('edit-pencil');
	}

	deleteIcon(row: Locator) {
		return row.getByTestId('delete');
	}

	// The popup that adds a field, also used to edit one.
	get form() {
		return this.dialog;
	}

	formText(text: string) {
		return this.form.getByText(text, { exact: true });
	}

	// The form's heading, e.g. "Add new field in Test Case".
	formHeading(text: string) {
		return this.form.getByRole('paragraph').filter({ hasText: text });
	}

	get nameField() {
		return this.form.getByRole('textbox', { name: 'Field Name' });
	}

	// The description has no name of its own; it is the box after the name.
	get descriptionField() {
		return this.form.getByRole('textbox').nth(1);
	}

	formButton(name: 'Add' | 'Update' | 'Cancel') {
		return this.form.getByRole('button', { name, exact: true });
	}

	// The chosen field type is shown beside its label.
	get fieldType() {
		return this.formText('Field Type').locator('xpath=..');
	}

	get configureOptions() {
		return this.formText('Configure Options*');
	}

	// The buttons other than Cancel and Update, which are the field's options.
	get optionButtons() {
		return this.form.getByRole('button').filter({ hasNotText: /^(Cancel|Update)$/ });
	}

	async openAddForm() {
		await this.addButton.click();
		await expect(this.nameField).toBeVisible();
	}

	async openEditForm(row: Locator) {
		await row.hover();
		await this.editIcon(row).click();
	}

	// The field type is chosen from a list that opens under the one chosen.
	async chooseType(current: string, type: string) {
		await this.formText(current).click();
		await this.formText(type).last().click();
		await expect(this.fieldType).toContainText(type);
	}

	async cancelForm() {
		await this.formButton('Cancel').click();
		await expect(this.form).toHaveCount(0);
	}
}
