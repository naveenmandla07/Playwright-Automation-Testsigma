/**
 * The Project Settings popup, opened from the project switcher, with its tabs: Project Details, Applications,
 * Versions, Project Members, Test Case Types and Requirement Types. Also the popups it opens for editing a version
 * and deleting the project.
 */
import { expect, type Page } from '@playwright/test';

export class ProjectSettingsDialog {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	get root() {
		return this.page.getByRole('dialog');
	}

	tab(name: string) {
		return this.root.getByText(name, { exact: true }).first();
	}

	heading(name: string) {
		return this.root.getByRole('heading', { name, exact: true });
	}

	// The Name field of Project Details and of Applications.
	get nameField() {
		return this.root.getByRole('textbox', { name: 'Name', exact: true });
	}

	get descriptionField() {
		return this.root.locator('textarea');
	}

	get updateButton() {
		return this.root.getByRole('button', { name: 'Update', exact: true });
	}

	get cancelButton() {
		return this.root.getByRole('button', { name: 'Cancel', exact: true });
	}

	get deleteProjectButton() {
		return this.root.getByRole('button', { name: 'Delete project', exact: true });
	}

	// A project option of Project Details, e.g. "Allow multiple versions".
	option(name: string) {
		return this.root.getByRole('checkbox', { name, exact: true });
	}

	text(text: string) {
		return this.root.getByText(text, { exact: true });
	}

	// A row of Versions or Project Members holding the text.
	row(text: string) {
		return this.root.getByRole('row').filter({ hasText: text });
	}

	get searchField() {
		return this.root.getByRole('textbox', { name: 'Search', exact: true });
	}

	// The search field, shown first when it is folded behind its icon.
	async showSearch() {
		if (!await this.searchField.isVisible()) await this.root.getByTestId('search').click();
		await expect(this.searchField).toBeVisible();
		return this.searchField;
	}

	/**
	 * Turns a Project Details option on or off and saves it, checking the update sent carries the change; returns
	 * once Testsigma says the project was updated. The form loads the saved values asynchronously and resets any
	 * change made before they arrive, so wait for them to show before calling this.
	 */
	async setOption(name: string, field: string, checked: boolean) {
		const checkbox = this.option(name);
		await expect(checkbox).toBeEnabled();
		// The decorative checkmark covers the input, and a keyboard toggle does not reach the form state; click the label.
		await expect(async () => {
			if (await checkbox.isChecked() !== checked) {
				await this.text(name).click();
			}
			await expect(checkbox).toBeChecked({ checked, timeout: 1000 });
			await expect(this.updateButton).toBeEnabled({ timeout: 1000 });
		}).toPass({ timeout: 15000 });
		const updateRequest = this.page.waitForRequest((request) => request.method() === 'PUT' && /\/private\/projects\/\d+$/.test(request.url()));
		await this.updateButton.click();
		expect((await updateRequest).postDataJSON()[field]).toBe(checked);
		await expect(this.page.getByText(/project.*updated.*successfully/i)).toBeVisible({ timeout: 30000 });
	}

	// Renames a test case or requirement type from its edit icon, saving it with Enter.
	async renameType(name: string, newName: string) {
		const label = this.text(name);
		await expect(label).toBeVisible();
		await label.hover();
		// Type rows have no role; scope the edit icon to the verified row container.
		await label.locator('../../..').getByTestId('edit').click();
		const input = this.root.locator('input:not([aria-label="Search"])');
		await expect(input).toHaveValue(name);
		await expect(this.text('Press Enter key to save')).toBeVisible();
		await input.fill(newName);
		await expect(input).toHaveValue(newName);
		await input.press('Enter');
		await expect(input).toBeHidden();
		await expect(this.text(newName)).toBeVisible();
		await expect(label).toHaveCount(0);
	}

	// Opens a version of the Versions tab for editing from its menu.
	async editVersion(name: string) {
		await this.row(name).getByTestId('more-vertical').click();
		await this.page.getByText('Edit Version', { exact: true }).click();
		return new EditVersionDialog(this.page);
	}

	async openDeleteProject() {
		await this.deleteProjectButton.click();
		return new DeleteProjectDialog(this.page);
	}
}

// The "Edit version" popup.
export class EditVersionDialog {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	get root() {
		return this.page.getByRole('dialog').filter({ has: this.page.getByRole('heading', { name: 'Edit version', exact: true }) });
	}

	get heading() {
		return this.root.getByRole('heading', { name: 'Edit version', exact: true });
	}

	get titleField() {
		return this.root.getByRole('textbox', { name: 'Title', exact: true });
	}

	get descriptionField() {
		return this.root.locator('textarea');
	}

	get rangeLabel() {
		return this.root.getByText('Start Date - End Date', { exact: true });
	}

	// The picked date range, e.g. "Oct 5, 2026 - Oct 15, 2026"; clicking it opens the calendar.
	get range() {
		return this.root.getByTestId('range-picker-result-placeholder');
	}

	// A day of the open calendar.
	day(date: Date) {
		return this.root.getByRole('button', { name: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), exact: true });
	}

	get updateButton() {
		return this.root.getByRole('button', { name: 'Update', exact: true });
	}

	get cancelButton() {
		return this.root.getByRole('button', { name: 'Cancel', exact: true });
	}

	async pickRange(start: Date, end: Date) {
		await this.range.click();
		await this.day(start).click();
		await this.day(end).click();
	}
}

// The "Delete project" popup, which asks for "DELETE" to be typed first.
export class DeleteProjectDialog {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	get root() {
		return this.page.getByRole('dialog').filter({ has: this.page.getByRole('textbox', { name: "Enter 'DELETE' to confirm.", exact: true }) });
	}

	get confirmField() {
		return this.root.getByRole('textbox', { name: "Enter 'DELETE' to confirm.", exact: true });
	}

	get title() {
		return this.root.getByText('Delete project', { exact: true });
	}

	get deleteButton() {
		return this.root.getByRole('button', { name: 'Delete', exact: true });
	}

	get cancelButton() {
		return this.root.getByRole('button', { name: 'Cancel', exact: true });
	}
}
