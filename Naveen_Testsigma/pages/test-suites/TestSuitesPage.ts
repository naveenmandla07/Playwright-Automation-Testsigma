/**
 * Test Suites: the list of a version's suites, the Create Test Suite form, and the full-screen picker that adds test
 * cases to a suite.
 */
import { expect, type Page } from '@playwright/test';
import { escapeRegExp } from '../../support/common';
import { BasePage } from '../BasePage';
import { SideNavigation } from '../components/SideNavigation';
import { isSuiteCreate, type Suite, type TestCase, type TestSuitesApi } from './TestSuitesApi';

// The list of the version's suites.
export class TestSuitesPage extends BasePage {
	readonly versionId: number;
	readonly heading = this.page.getByRole('heading', { name: 'Test Suites', level: 1 });
	readonly createLink = this.main.getByText('Create Test Suite', { exact: true }).first();
	readonly search = this.main.getByRole('textbox', { name: 'Search' });
	readonly selectAll = this.main.getByRole('checkbox', { name: 'Select All', exact: true });

	constructor(page: Page, versionId: number) {
		super(page);
		this.versionId = versionId;
	}

	async openFromNavigation() {
		await new SideNavigation(this.page).hover(300);
		await this.page.getByRole('link', { name: 'Test Suites', exact: true }).click();
		await expect(this.page).toHaveURL(new RegExp(`/td/${this.versionId}/suites$`), { timeout: 30000 });
		await expect(this.heading).toBeVisible({ timeout: 30000 });
		// Move off the navigation so it folds away.
		await this.page.mouse.move(1000, 600);
	}

	async expectOpen() {
		await expect(this.page).toHaveURL(new RegExp(`/td/${this.versionId}/suites$`), { timeout: 30000 });
	}

	text(text: string) {
		return this.main.getByText(text, { exact: true });
	}

	// The count of every suite listed, e.g. "All (3)".
	allCount(count: number) {
		return this.text(`All (${count})`);
	}

	suiteLink(name: string) {
		return this.main.getByRole('grid').getByRole('link', { name, exact: true });
	}

	// A suite's row, named after its checkbox, "Select <name> ...".
	suiteRow(name: string) {
		return this.page.getByRole('grid').getByRole('row', { name: new RegExp(`^Select ${escapeRegExp(name)} `) }).last();
	}

	async startCreating() {
		await this.page.getByText('Create Test Suite', { exact: true }).first().click();
		const form = new CreateTestSuitePage(this.page, this.versionId);
		await expect(this.page).toHaveURL(new RegExp(`/td/${this.versionId}/suites/new$`), { timeout: 30000 });
		await expect(form.createButton).toBeDisabled({ timeout: 30000 });
		return form;
	}
}

// The Create Test Suite form.
export class CreateTestSuitePage extends BasePage {
	readonly versionId: number;
	readonly nameField = this.main.getByRole('textbox', { name: 'Name', exact: true });
	readonly createButton = this.page.getByRole('button', { name: 'Create', exact: true });
	readonly cancelButton = this.main.getByRole('button', { name: 'Cancel', exact: true });
	readonly addRemoveTestCases = this.main.getByText('Add/Remove Test Case', { exact: true });
	// The test cases added, as the form lists them.
	readonly addedCases = this.main.getByRole('grid').getByRole('gridcell');

	constructor(page: Page, versionId: number) {
		super(page);
		this.versionId = versionId;
	}

	text(text: string) {
		return this.main.getByText(text, { exact: true });
	}

	// The heading carries a required-field asterisk, e.g. "Test Cases (3)*".
	testCasesHeading(count: number) {
		return this.main.getByText(new RegExp(`^Test Cases \\(${count}\\)\\s*\\*?$`));
	}

	async openPicker() {
		await this.page.getByText('Add/Remove Test Case', { exact: true }).click();
		const picker = new TestCasePicker(this.page);
		await expect(picker.availableLabel()).toBeVisible({ timeout: 30000 });
		await expect(picker.availableCheckboxes.first()).toBeVisible({ timeout: 30000 });
		return picker;
	}

	// Saves the suite with the test cases added to the form, checks it holds exactly those cases, and returns it.
	async save(api: TestSuitesApi, name: string, cases: TestCase[]) {
		await expect(this.testCasesHeading(cases.length)).toBeVisible();
		// The form only draws the rows that fit on screen, in the order the cases were selected.
		await expect(this.addedCases.first()).toBeVisible();
		const shownCases = await this.addedCases.allInnerTexts();
		expect(cases.map((testCase) => testCase.name)).toEqual(expect.arrayContaining(shownCases.map((text) => text.trim())));

		// A suite needs both a name and at least one test case.
		await expect(this.createButton).toBeDisabled();
		await this.page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
		await expect(this.createButton).toBeEnabled();

		const createRequest = this.page.waitForRequest(isSuiteCreate);
		await this.createButton.click();
		const request = await createRequest;
		const response = (await request.response())!;
		expect(response.status()).toBe(201);
		const body = request.postDataJSON();
		expect(body).toMatchObject({ name, appVersionId: this.versionId });
		expect([...body.testCaseIds].sort()).toEqual(cases.map((testCase) => testCase.id).sort());
		const created: Suite = await response.json();
		expect(created).toMatchObject({ name, totalTestCasesCount: cases.length });

		await expect(this.page.getByText('Test Suite created successfully').first()).toBeVisible();
		const suites = new TestSuitesPage(this.page, this.versionId);
		await suites.expectOpen();
		const row = suites.suiteRow(name);
		await expect(row.getByRole('link', { name, exact: true })).toHaveAttribute('href', new RegExp(`/suites/${created.id}/cases$`));
		await expect(row.getByRole('gridcell', { name: 'Static', exact: true })).toBeVisible();
		await expect(row.getByRole('gridcell', { name: 'No Runs', exact: true })).toBeVisible();

		// The suite is stored with the chosen test cases.
		expect(await api.get(created.id)).toMatchObject({ name, appVersionId: this.versionId, totalTestCasesCount: cases.length });
		return created;
	}
}

// The picker is a full-screen panel rather than a dialog; its left half lists the available test cases and its right
// half those selected for the suite.
export class TestCasePicker {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	get root() {
		return this.page.locator('div')
			.filter({ has: this.page.getByText('Add/Remove Test Cases', { exact: true }) })
			.filter({ has: this.page.getByRole('button', { name: 'Add to Suite', exact: true }) })
			.last();
	}

	get title() {
		return this.root.getByText('Add/Remove Test Cases', { exact: true });
	}

	text(text: string) {
		return this.root.getByText(text, { exact: true });
	}

	// "Available Test Cases (n)", for the count given or any.
	availableLabel(count?: number) {
		return count === undefined ? this.root.getByText(/^Available Test Cases \(\d+\)$/) : this.text(`Available Test Cases (${count})`);
	}

	async availableCount() {
		const label = await this.availableLabel().innerText();
		return Number(label.match(/\((\d+)\)/)![1]);
	}

	selectedLabel(count: number) {
		return this.text(`Selected for Test Suite (${count})`);
	}

	get availableCheckboxes() {
		return this.root.getByRole('grid').first().getByRole('checkbox', { name: /^Select / });
	}

	get selectedCheckboxes() {
		return this.root.getByRole('grid').last().getByRole('checkbox', { name: /^Select / });
	}

	availableCheckbox(name: string) {
		return this.availableCheckboxes.and(this.root.getByRole('checkbox', { name: `Select ${name}`, exact: true }));
	}

	get selectAll() {
		return this.root.getByRole('checkbox', { name: 'Select All', exact: true }).first();
	}

	// The search box stays collapsed until its icon is clicked. Once a case is selected the right-hand list gets a
	// search box too; the left one comes first.
	get searchIcon() {
		return this.root.getByTestId('search').first();
	}

	get search() {
		return this.root.getByRole('textbox', { name: 'Search' });
	}

	button(name: 'Select' | 'Remove' | 'Add to Suite' | 'Cancel') {
		return this.root.getByRole('button', { name, exact: true });
	}

	// Adds the selected cases to the suite, closing the picker.
	async addToSuite() {
		await this.button('Add to Suite').click();
		await expect(this.title).toBeHidden();
	}
}
