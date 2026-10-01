/**
 * Environments, under Test Data: the list of environments, an environment's details page with its variables, and the
 * project's Variables page, which shows the same variables table with the project defaults.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../BasePage';
import { SideNavigation } from '../components/SideNavigation';
import { isVariablesSave } from './EnvironmentsApi';

// Stored encrypted values come back as ciphertext only.
export const ciphertext = /^V2:\S+$/;

// The list of environments.
export class EnvironmentsPage extends BasePage {
	readonly createButton = this.page.getByRole('button', { name: 'Create Environment' });
	readonly createDialog = new CreateEnvironmentDialog(this.page);

	// Opens the list from the side navigation and returns its address.
	async openFromNavigation() {
		await new SideNavigation(this.page).openUnderTestData('Environments', { exact: true });
		await expect(this.page).toHaveURL(/\/td\/\d+\/environments$/, { timeout: 30000 });
		await expect(this.createButton).toBeVisible({ timeout: 30000 });
		return this.page.url();
	}

	row(name: string) {
		return this.page.getByRole('grid').getByRole('row', { name, exact: true });
	}

	link(name: string) {
		return this.row(name).getByRole('link', { name });
	}
}

// The "Create Environment" popup.
export class CreateEnvironmentDialog {
	readonly root: Locator;

	constructor(page: Page) {
		this.root = page.getByRole('dialog').filter({ hasText: 'Create Environment' });
	}

	get heading() {
		return this.root.getByRole('heading', { name: 'Create Environment' });
	}

	get nameField() {
		return this.root.getByRole('textbox', { name: 'Environment Name' });
	}

	get descriptionField() {
		return this.root.getByRole('textbox', { name: 'Write here' });
	}

	get createButton() {
		return this.root.getByRole('button', { name: 'Create', exact: true });
	}

	get cancelButton() {
		return this.root.getByRole('button', { name: 'Cancel', exact: true });
	}
}

// The "Add Environment Variable" popup.
export class AddVariableDialog {
	readonly root: Locator;

	constructor(page: Page) {
		this.root = page.getByRole('dialog').filter({ hasText: 'Add Environment Variable' });
	}

	get heading() {
		return this.root.getByRole('heading', { name: 'Add Environment Variable' });
	}

	get keyField() {
		return this.root.getByRole('textbox', { name: 'Variable', exact: true });
	}

	get valueField() {
		return this.root.getByRole('textbox', { name: 'Default Value', exact: true });
	}

	// The unlocked icon is named "decrypt" and turns encryption on; once on, it shows as "lock".
	get encryptIcon() {
		return this.root.getByTestId('decrypt');
	}

	get lockIcon() {
		return this.root.getByTestId('lock');
	}

	// Shows the hidden value; once shown, the icon hides it again.
	get showValueIcon() {
		return this.root.getByTestId('visibility-off-outline');
	}

	get hideValueIcon() {
		return this.root.getByTestId('visibility-outline');
	}

	get createButton() {
		return this.root.getByRole('button', { name: 'Create', exact: true });
	}

	get cancelButton() {
		return this.root.getByRole('button', { name: 'Cancel', exact: true });
	}
}

// An environment's details page, or the project's Variables page; both list variables in the same table.
export class EnvironmentPage extends BasePage {
	// The address of the list of environments, which the others are found from.
	readonly environmentsUrl: string;
	readonly table = this.page.locator('main table');
	readonly rows = this.table.getByRole('rowgroup').nth(1).getByRole('row');
	readonly addVariableButton = this.page.getByRole('button', { name: 'Add Variable', exact: true });
	readonly addVariableDialog = new AddVariableDialog(this.page);
	readonly unsavedChanges = this.page.getByText('You have unsaved changes', { exact: true });
	readonly updateButton = this.page.getByRole('button', { name: 'Update', exact: true });
	readonly cancelButton = this.page.getByRole('button', { name: 'Cancel', exact: true });
	readonly deleteButton = this.page.getByRole('button', { name: 'Delete environment' });

	constructor(page: Page, environmentsUrl: string) {
		super(page);
		this.environmentsUrl = environmentsUrl;
	}

	title(name: string) {
		return this.main.getByText(name, { exact: true });
	}

	description(text: string) {
		return this.page.getByRole('paragraph').filter({ hasText: text });
	}

	detailsUrl(id: number) {
		return this.environmentsUrl.replace(/\/environments$/, `/environments/${id}/details`);
	}

	async open(id: number, name: string) {
		await this.page.goto(this.detailsUrl(id));
		await expect(this.title(name)).toBeVisible({ timeout: 30000 });
		await expect(this.table).toBeVisible({ timeout: 30000 });
	}

	// The project's Variables page, showing every variable with its default value.
	async openProjectVariables() {
		await this.page.goto(this.environmentsUrl.replace(/\/environments$/, '/environments/variables'));
		await expect(this.table).toBeVisible({ timeout: 30000 });
	}

	// Rows have no stable name, so match the one whose name textbox holds the variable.
	variableRow(key: string) {
		return this.rows.filter({ has: this.page.locator(`input[value="${key}"]`) });
	}

	nameField(row: Locator) {
		return row.getByRole('textbox', { name: /^Variable Name at : \d+$/ });
	}

	valueField(row: Locator) {
		return row.getByRole('textbox', { name: /^Variable Value at : \d+$/ });
	}

	// The inline editors only register typed input; fill() leaves the page without unsaved changes.
	async typeInto(field: Locator, value: string) {
		await field.click();
		await this.page.keyboard.press('ControlOrMeta+A');
		await this.page.keyboard.type(value);
		await this.page.keyboard.press('Tab');
		await expect(field).toHaveValue(value);
	}

	// Adds a variable from the popup, checking the popup and that the save sent it unencrypted.
	async addVariable(key: string, value: string) {
		await this.addVariableButton.click();
		const dialog = this.addVariableDialog;
		await expect(dialog.heading).toBeVisible();
		await expect(dialog.createButton).toBeDisabled();
		await expect(dialog.cancelButton).toBeEnabled();

		await dialog.keyField.fill(key);
		await dialog.valueField.fill(value);
		await expect(dialog.createButton).toBeEnabled();
		// Variables are saved as a batch for the whole project; the response has no body.
		const createResponse = this.page.waitForResponse((response) => isVariablesSave(response.request()));
		await dialog.createButton.click();
		const response = await createResponse;
		expect(response.ok()).toBe(true);
		expect(response.request().postDataJSON()).toEqual([expect.objectContaining({ key, value, isEncrypted: false })]);
		await expect(dialog.root).toBeHidden();
		await expect(this.page.getByText('Variable created successfully').first()).toBeVisible();
		await expect(this.variableRow(key)).toBeVisible();
	}

	async expectVariable(key: string, value: string) {
		const row = this.variableRow(key);
		await expect(row).toHaveCount(1);
		await expect(this.nameField(row)).toHaveValue(key);
		await expect(this.valueField(row)).toHaveValue(value);
	}

	// An encrypted variable shows only its ciphertext, hidden, and its lock.
	async expectEncryptedRow(key: string) {
		const row = this.variableRow(key);
		await expect(row).toHaveCount(1);
		await expect(this.valueField(row)).toHaveAttribute('type', 'password');
		await expect(this.valueField(row)).toHaveValue(ciphertext);
		await expect(row.getByTestId('lock')).toBeVisible();
		await expect(row.getByTestId('decrypt')).toHaveCount(0);
	}

	// The "Delete Confirmation" popup for the environment.
	get deleteDialog() {
		return this.page.getByRole('dialog').filter({ hasText: 'Delete Confirmation' });
	}
}
