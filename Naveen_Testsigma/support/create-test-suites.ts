/**
 * Steps shared by the "Create test suites" specs under Test Suite Module. Each application of the
 * "[9.0.8] Accessibility" project has its own spec, which declares the tests and runs these steps for it on the
 * Test Suites page objects.
 */
import { expect, test, type Page } from '@playwright/test';
import { TestSuitesApi } from '../pages/test-suites/TestSuitesApi';
import { TestSuitesPage } from '../pages/test-suites/TestSuitesPage';
import { versionName, type SuiteApplication } from './accessibility-project';

const allCasesSuiteName = 'All test cases included in Tests Suite 1';
const randomCasesSuiteName = 'Selected random cases in Test Suite 2';

export const suiteNames = { allCases: allCasesSuiteName, randomCases: randomCasesSuiteName };

export async function verifyTestSuitesPage(page: Page, versionId: number) {
	const api = new TestSuitesApi(page, versionId);
	const suitesPage = new TestSuitesPage(page, versionId);
	// Start from suites this run creates being absent, so the page and names are predictable.
	await api.deleteNamed(allCasesSuiteName);
	await api.deleteNamed(randomCasesSuiteName);
	await suitesPage.openFromNavigation();

	await expect(suitesPage.createLink).toBeVisible();
	const suites = await api.list();
	if (suites.length === 0) {
		await expect(suitesPage.text('No Suites have been created')).toBeVisible();
		await expect(suitesPage.main.getByRole('img', { name: 'Empty state illustration' })).toBeVisible();
	} else {
		await expect(suitesPage.search).toBeVisible();
		await expect(suitesPage.allCount(suites.length)).toBeVisible();
		await expect(suitesPage.text('Show Filters')).toBeVisible();
		await expect(suitesPage.text('Sort by')).toBeVisible();
		for (const column of ['Title', 'Type', 'Created', 'Created by', 'Status']) {
			await expect(suitesPage.text(column).first()).toBeVisible();
		}
		await expect(suitesPage.suiteLink(suites[0].name)).toBeVisible();
	}
}

export async function verifyCreateFormAndPicker(page: Page, { name: applicationName }: SuiteApplication, versionId: number) {
	const api = new TestSuitesApi(page, versionId);
	const suitesPage = new TestSuitesPage(page, versionId);
	await suitesPage.openFromNavigation();
	const form = await suitesPage.startCreating();
	await expect(form.text('Create Test Suite')).toBeVisible();
	await expect(form.main.getByRole('link', { name: 'Help' })).toHaveAttribute('href', /testsigma\.com\/docs\/test-management\/test-suites/);
	await expect(form.cancelButton).toBeEnabled();
	await expect(form.text('Basic Details')).toBeVisible();
	await expect(form.nameField).toBeEmpty();
	await expect(form.main.getByRole('checkbox', { name: 'Description' })).not.toBeChecked();
	await expect(form.text('Pre-Requisite')).toBeVisible();
	await expect(form.text('None')).toBeVisible();
	await expect(form.main.getByRole('textbox', { name: 'Add Label' })).toBeVisible();
	await expect(form.testCasesHeading(0)).toBeVisible();
	await expect(form.addRemoveTestCases).toBeVisible();
	await expect(form.main.getByRole('checkbox', { name: 'AfterTest Suite' })).not.toBeChecked();

	// A name alone is not enough to create a suite.
	await form.nameField.fill('Suite without test cases');
	await expect(form.main.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();

	const picker = await form.openPicker();
	const total = await picker.availableCount();
	expect(total, `${applicationName} version ${versionName} has no ready, automated test cases`).toBeGreaterThanOrEqual(1);
	await expect(picker.text(`All (${total})`).first()).toBeVisible();
	await expect(picker.text('Saved Filters').first()).toBeVisible();
	await expect(picker.text('Show Filters').first()).toBeVisible();
	await expect(picker.text('Sort by')).toBeVisible();
	// The search box stays collapsed until its icon is clicked.
	await picker.searchIcon.click();
	await expect(picker.search).toBeVisible();
	await expect(picker.selectedLabel(0)).toBeVisible();
	await expect(picker.text('No Test Case has been added to this suite')).toBeVisible();
	await expect(picker.button('Select')).toBeDisabled();
	await expect(picker.button('Remove')).toBeDisabled();
	await expect(picker.button('Add to Suite')).toBeDisabled();

	// Checking a test case enables moving it; Remove moves it back.
	await picker.availableCheckboxes.first().check();
	await expect(picker.button('Select')).toBeEnabled();
	await picker.button('Select').click();
	await expect(picker.selectedLabel(1)).toBeVisible();
	await expect(picker.button('Add to Suite')).toBeEnabled();
	await picker.selectedCheckboxes.first().check();
	await picker.button('Remove').click();
	await expect(picker.selectedLabel(0)).toBeVisible();

	// Leaving the picker and the form saves nothing.
	await picker.button('Cancel').click();
	await expect(picker.title).toBeHidden();
	await expect(form.testCasesHeading(0)).toBeVisible();
	await form.cancelButton.click();
	await suitesPage.expectOpen();
	expect((await api.list()).map((suite) => suite.name)).not.toContain('Suite without test cases');
}

export async function createSuiteWithAllCases(page: Page, versionId: number) {
	const api = new TestSuitesApi(page, versionId);
	const suitesPage = new TestSuitesPage(page, versionId);
	await suitesPage.openFromNavigation();
	const form = await suitesPage.startCreating();
	const picker = await form.openPicker();
	const cases = await api.pickableTestCases();
	await expect(picker.availableLabel(cases.length)).toBeVisible();

	await picker.selectAll.check();
	// The list only draws the rows that fit on screen; each drawn row is checked.
	for (const checkbox of await picker.availableCheckboxes.all()) {
		await expect(checkbox).toBeChecked();
	}
	await picker.button('Select').click();
	await expect(picker.selectedLabel(cases.length)).toBeVisible();
	await picker.addToSuite();

	await form.save(api, allCasesSuiteName, cases);
}

export async function createSuiteWithRandomCases(page: Page, { name: applicationName }: SuiteApplication, versionId: number) {
	const api = new TestSuitesApi(page, versionId);
	const suitesPage = new TestSuitesPage(page, versionId);
	await suitesPage.openFromNavigation();
	const form = await suitesPage.startCreating();
	const picker = await form.openPicker();
	const available = await api.pickableTestCases();
	expect(available.length, `${applicationName} version ${versionName} needs at least 5 ready, automated test cases to pick from`).toBeGreaterThanOrEqual(5);
	const count = 4 + Math.floor(Math.random() * 2);
	const chosen = [...available].sort(() => Math.random() - 0.5).slice(0, count);
	test.info().annotations.push({ type: 'Selected test cases', description: chosen.map((testCase) => testCase.name).join(', ') });

	// The list only draws the rows that fit on screen, so search for each chosen case and move it across.
	await picker.searchIcon.click();
	const search = picker.search.first();
	for (const [index, testCase] of chosen.entries()) {
		await search.fill(testCase.name);
		const checkbox = picker.availableCheckbox(testCase.name);
		await expect(checkbox).toBeVisible();
		await checkbox.check();
		await picker.button('Select').click();
		await expect(picker.selectedLabel(index + 1)).toBeVisible();
	}
	await search.clear();
	await expect(picker.availableLabel(available.length)).toBeVisible();
	await picker.addToSuite();

	await form.save(api, randomCasesSuiteName, chosen);
	// Both suites of this run are listed, and the list view has its search, filters and columns.
	for (const name of [allCasesSuiteName, randomCasesSuiteName]) {
		await expect(suitesPage.suiteLink(name)).toHaveCount(1);
	}
	const suiteCount = (await api.list()).length;
	await expect(suitesPage.allCount(suiteCount)).toBeVisible();
	await expect(suitesPage.search).toBeVisible();
	await expect(suitesPage.text('Show Filters')).toBeVisible();
	await expect(suitesPage.text('Sort by')).toBeVisible();
	await expect(suitesPage.selectAll).toBeVisible();
	for (const column of ['Title', 'Type', 'Created', 'Created by', 'Status']) {
		await expect(suitesPage.text(column).first()).toBeVisible();
	}

	// Searching narrows the list to the matching suite.
	await suitesPage.search.fill('Test Suite 2');
	await expect(suitesPage.suiteLink(randomCasesSuiteName)).toBeVisible();
	await expect(suitesPage.suiteLink(allCasesSuiteName)).toHaveCount(0);
	await suitesPage.search.clear();
	await expect(suitesPage.suiteLink(allCasesSuiteName)).toBeVisible();
}
