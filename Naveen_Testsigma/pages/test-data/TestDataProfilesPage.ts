/**
 * Test Data Profiles, under Test Data: the tree of folders and profiles, the folder popups, a profile's editor with
 * its grid of parameters and data sets, and importing a profile from an Excel file.
 */
import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { escapeRegExp } from '../../support/common';
import { BasePage } from '../BasePage';
import { SideNavigation } from '../components/SideNavigation';

export class TestDataProfilesPage extends BasePage {
	readonly tree = this.page.getByRole('tree');
	readonly addFolderButton = this.page.getByRole('button', { name: 'Add Folder' });
	readonly search = this.main.getByRole('textbox', { name: 'Search' }).first();

	async openFromNavigation() {
		await new SideNavigation(this.page).openUnderTestData('Test Data Profiles');
		await expect(this.page).toHaveURL(/\/data\/folders$/, { timeout: 30000 });
		await expect(this.page.getByRole('heading', { name: 'Select or Create Test Data Profile to manage your test data' })).toBeVisible({ timeout: 30000 });
	}

	// Loads the page afresh, from whichever profile is open.
	async reload() {
		await this.page.goto(this.page.url().replace(/\/data\/folders.*$/, '/data/folders'));
		await expect(this.tree).toBeVisible({ timeout: 30000 });
	}

	// Folder rows are named after the folder plus an item count once it has children, e.g. "Feature (2)".
	folder(name: string) {
		return this.tree.getByRole('button', { name: new RegExp(`^${escapeRegExp(name)}( \\(\\d+\\))?$`) });
	}

	profile(name: string) {
		return this.tree.getByRole('link', { name, exact: true });
	}

	async expand(folder: Locator) {
		await expect(folder).toBeVisible();
		if (await folder.getAttribute('aria-expanded') !== 'true') {
			await folder.click();
		}
		await expect(folder).toHaveAttribute('aria-expanded', 'true');
	}

	async chooseFromFolderMenu(folder: Locator, option: string) {
		const menuOption = this.page.getByText(option, { exact: true });
		// The options icon only appears on hover, and a tree refresh can close or re-render the menu while it is being clicked.
		await expect(async () => {
			await folder.hover();
			await folder.getByTestId('more-vertical').click();
			await expect(menuOption).toBeVisible({ timeout: 2000 });
			await menuOption.click({ timeout: 2000 });
		}).toPass({ timeout: 30000 });
	}

	// The folder popup, for adding or renaming: checks it, enters the name and submits it.
	private async submitFolderDialog(heading: string, name: string, submit: string) {
		const dialog = this.page.getByRole('dialog').filter({ hasText: heading });
		const nameField = dialog.getByRole('textbox', { name: 'Enter folder name' });
		const submitButton = dialog.getByRole('button', { name: submit, exact: true });
		await expect(dialog.getByText(heading, { exact: true })).toBeVisible();
		await expect(submitButton).toBeDisabled();
		await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
		await nameField.fill(name);
		await expect(submitButton).toBeEnabled();
		await submitButton.click();
		await expect(dialog).toBeHidden();
	}

	// Creates a folder, inside the parent when given, and returns it as Testsigma made it.
	async createFolder(name: string, parent?: Locator) {
		const createResponse = this.page.waitForResponse((response) => response.request().method() === 'POST' && /\/private\/test_data\/folders$/.test(response.url()));
		if (parent) {
			await this.chooseFromFolderMenu(parent, 'Add Sub Folder');
		} else {
			await this.addFolderButton.click();
			await this.page.getByText('Add Folder', { exact: true }).last().click();
		}
		await this.submitFolderDialog('Add Folder', name, 'Create');
		const created = await (await createResponse).json();
		expect(created.name).toBe(name);
		await expect(this.page.getByText('Folder added successfully').first()).toBeVisible();
		return created as { id: number; parentId: number | null };
	}

	async renameFolder(currentName: string, newName: string) {
		await this.chooseFromFolderMenu(this.folder(currentName), 'Rename');
		await expect(this.page.getByRole('dialog').getByRole('textbox', { name: 'Enter folder name' })).toHaveValue(currentName);
		const renameResponse = this.page.waitForResponse((response) => response.request().method() === 'PUT' && /\/private\/test_data\/folders\/\d+$/.test(response.url()));
		await this.submitFolderDialog('Rename Folder', newName, 'Save');
		expect((await (await renameResponse).json()).name).toBe(newName);
		await expect(this.page.getByText('Folder updated successfully').first()).toBeVisible();
		await expect(this.folder(newName)).toBeVisible();
		await expect(this.folder(currentName)).toBeHidden();
	}

	// The child is shown one level below the parent, which counts it as its one item.
	async expectSubFolder(parentName: string, childName: string) {
		const parent = this.folder(parentName);
		await this.expand(parent);
		const child = this.folder(childName);
		await expect(child).toBeVisible();
		const parentLevel = Number(await parent.getAttribute('aria-level'));
		await expect(child).toHaveAttribute('aria-level', String(parentLevel + 1));
		await expect(parent).toHaveAccessibleName(`${parentName} (1)`);
	}

	// The "Delete Folder" popup.
	get deleteFolderDialog() {
		return this.page.getByRole('dialog').filter({ hasText: 'Delete Folder' });
	}

	// Opens a profile from the tree and returns its id.
	async openProfile(name: string) {
		await this.profile(name).click();
		await expect(this.page).toHaveURL(/\/data\/folders\/\d+\/sets$/, { timeout: 30000 });
		await expect(new TestDataProfileEditor(this.page).title(name)).toBeVisible({ timeout: 30000 });
		return Number(this.page.url().match(/\/data\/folders\/(\d+)\/sets$/)![1]);
	}
}

// A test data profile, new or opened: its name in the info panel, and its grid of parameters (columns) and data sets
// (rows).
export class TestDataProfileEditor extends BasePage {
	readonly table = this.page.getByRole('table');
	readonly dataSetRows = this.table.getByRole('rowgroup').nth(1).getByRole('row');
	readonly nameField = this.page.getByRole('textbox', { name: 'Name' });
	readonly createButton = this.page.getByRole('button', { name: 'Create', exact: true });
	readonly cancelButton = this.page.getByRole('button', { name: 'Cancel', exact: true });
	readonly deleteButton = this.page.getByRole('button', { name: 'Delete', exact: true });
	// Unsaved grid edits replace the "Update" (import) icon with a text "Update" button that saves them.
	readonly saveChangesButton = this.page.getByRole('button').filter({ hasText: /^Update$/ });
	private readonly infoPanelTitle = this.page.getByText('Test Data Profile Info', { exact: true });

	title(name: string) {
		return this.main.getByText(name, { exact: true }).last();
	}

	// The grid's "+" buttons have no accessible name, only a tooltip: the first adds a column, the last adds a row.
	get addColumnButton() {
		return this.page.locator('main span.popper__reference > div.text-white').first();
	}

	get addRowButton() {
		return this.page.locator('main span.popper__reference > div.text-white').last();
	}

	column(name: string) {
		return this.page.getByRole('columnheader', { name, exact: true });
	}

	// Cells 0 and 1 are S.No. and ETF, so the Set Name is cell 2 and parameters follow it.
	async fillDataSet(row: Locator, values: string[]) {
		const cells = row.getByRole('cell');
		for (const [index, value] of values.entries()) {
			const cell = cells.nth(index + 2).getByRole('textbox');
			// The grid re-renders after each edit and can drop a value typed mid-render, so re-enter it until it sticks.
			await expect(async () => {
				await cell.click();
				await this.page.keyboard.press('ControlOrMeta+A');
				await this.page.keyboard.type(value);
				await cells.first().click();
				await this.page.waitForTimeout(500);
				expect(await cell.inputValue()).toBe(value);
			}).toPass({ timeout: 20000 });
		}
	}

	async renameColumn(currentName: string, newName: string) {
		const header = this.column(currentName);
		await header.dblclick();
		await header.getByRole('textbox').fill(newName);
		await this.page.keyboard.press('Enter');
		await expect(this.column(newName)).toBeVisible();
	}

	// The info panel holds the Name field; on narrow viewports it squeezes the grid until sticky columns cover the
	// parameter cells and headers, so keep it closed while editing the grid.
	async setInfoPanel(open: boolean) {
		if (await this.infoPanelTitle.isVisible() === open) return;
		await (open ? this.page.locator('main [data-testid="info"]').last() : this.main.getByTestId('close')).click();
		await expect(this.infoPanelTitle).toBeVisible({ visible: open });
	}

	// The grid can show a typed value it has not stored and then refuses to save ("Test data set name is missing...").
	// When no save request follows the click, retype every data set and try again.
	async saveDataSets(saveButton: Locator, values: string[][], isSaveRequest: (response: Response) => boolean) {
		for (let attempt = 1; ; attempt++) {
			const saveResponse = this.page.waitForResponse(isSaveRequest, { timeout: 10000 }).catch(() => undefined);
			await saveButton.click();
			const response = await saveResponse;
			if (response) return response;
			if (attempt === 3) throw new Error(`The test data profile was not saved after ${attempt} attempts.`);

			const infoPanelOpen = await this.infoPanelTitle.isVisible();
			await this.setInfoPanel(false);
			for (const [index, rowValues] of values.entries()) {
				await this.fillDataSet(this.dataSetRows.nth(index), rowValues);
			}
			await this.setInfoPanel(infoPanelOpen);
		}
	}

	async expectDataSets(expected: string[][]) {
		await expect(this.dataSetRows).toHaveCount(expected.length);
		for (const [rowIndex, values] of expected.entries()) {
			const cells = this.dataSetRows.nth(rowIndex).getByRole('cell');
			await expect(cells.first()).toHaveText(String(rowIndex + 1).padStart(2, '0'));
			for (const [index, value] of values.entries()) {
				await expect(cells.nth(index + 2).getByRole('textbox')).toHaveValue(value);
			}
		}
	}

	async expectColumns(expected: string[]) {
		await expect(this.table.getByRole('columnheader')).toHaveText(['S.No.', 'ETF', 'Set Name', ...expected]);
	}

	// Deletes the open profile, checking the confirmation, which asks for "DELETE" to be typed first, and that the
	// profile is gone afterwards.
	async delete(name: string, id: number) {
		await this.deleteButton.click();

		const dialog = this.page.getByRole('dialog');
		const confirmationInput = dialog.getByRole('textbox', { name: "Enter 'DELETE' to confirm." });
		const confirmButton = dialog.getByRole('button', { name: 'I understand, delete this test data' });
		await expect(dialog.getByText('Delete Test data profile?')).toBeVisible();
		await expect(dialog).toContainText(`Are you absolutely sure you want to delete ${name}?`);
		await expect(dialog).toContainText('It will be permanently deleted and will not be retrievable.');
		await expect(confirmationInput).toBeEmpty();
		await expect(confirmButton).toBeDisabled();
		await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();

		await confirmationInput.fill('DELETE');
		await expect(confirmButton).toBeEnabled();
		const deleteResponse = this.page.waitForResponse((response) => response.request().method() === 'DELETE' && response.url().includes(`/private/test_data/${id}`));
		await confirmButton.click();
		expect((await deleteResponse).ok()).toBe(true);

		await expect(this.page).toHaveURL(/\/data\/folders$/, { timeout: 30000 });
		await expect(this.page.getByRole('tree').getByRole('link', { name, exact: true })).toBeHidden();

		await this.page.goto(this.page.url().replace(/\/data\/folders$/, `/data/folders/${id}/sets`));
		await expect(this.page.getByText(`Test Data Not Found with id: ${id}`)).toBeVisible({ timeout: 30000 });
	}
}

// The "Select Location" popup, choosing the folder an imported profile goes in.
export class SelectLocationDialog {
	readonly root: Locator;

	constructor(page: Page) {
		this.root = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Select Location' }) });
	}

	get confirmButton() {
		return this.root.getByRole('button', { name: 'Confirm', exact: true });
	}

	folder(name: string) {
		return this.root.getByRole('treeitem', { name, exact: true });
	}
}

// The "Import Test Data Profile" popup.
export class ImportProfileDialog {
	readonly page: Page;
	readonly root: Locator;

	constructor(page: Page) {
		this.page = page;
		this.root = page.getByRole('dialog').filter({ hasText: 'Import Test Data Profile' });
	}

	get fileInput() {
		return this.page.getByTestId('dnd-file-uploader-input');
	}

	get nameField() {
		return this.root.getByRole('textbox', { name: 'Name' });
	}

	get importButton() {
		return this.root.getByRole('button', { name: 'Import', exact: true });
	}

	text(text: string, options?: { exact: boolean }) {
		return this.root.getByText(text, options);
	}
}
