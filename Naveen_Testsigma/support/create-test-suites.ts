/**
 * Steps shared by the "Create test suites" specs under Test Suite Module. Each application of the
 * "[9.0.8] Accessibility" project has its own spec, which declares the tests and runs these steps for it.
 */
import { expect, test, type Browser, type Locator, type Page, type Request } from '@playwright/test';
import { signInToTestsigma } from './testsigma-auth';

const projectName = '[9.0.8] Accessibility';
const versionName = '1';
const allCasesSuiteName = 'All test cases included in Tests Suite 1';
const randomCasesSuiteName = 'Selected random cases in Test Suite 2';

type Suite = { id: number; name: string; totalTestCasesCount: number };
type TestCase = { id: number; name: string };

// An application of the project, as named in the project switcher, with its Testsigma application type.
export type SuiteApplication = { name: string; type: string };

// The side navigation only shows labels while hovered. Moving onto the spot the pointer is already on does not
// count as hovering, so move away first.
export async function hoverNavigation(page: Page, y: number) {
	await page.mouse.move(800, 500);
	await page.mouse.move(20, y);
}

// The side navigation's second button opens the project switcher.
function projectSwitcherButton(page: Page) {
	return page.getByRole('navigation').getByRole('button').nth(1);
}

function switcherDropdown(page: Page, label: 'Project' | 'Application' | 'Version') {
	return page.getByText(label, { exact: true }).locator('..').locator('[data-isopen]');
}

async function findVersionId(page: Page, applicationName: string, applicationType: string) {
	const projects = (await (await page.request.get('/private/projects?size=500&page=0')).json()).content;
	const project = projects.find((item: { name: string }) => item.name === projectName);
	expect(project, `project ${projectName}`).toBeDefined();
	const applications = (await (await page.request.get(`/private/applications?query=projectId:${project.id}&size=100&page=0`)).json()).content;
	const application = applications.find((item: { name: string }) => item.name === applicationName);
	expect(application, `application ${applicationName}`).toBeDefined();
	expect(application.applicationType).toBe(applicationType);
	const versions = (await (await page.request.get(`/private/application_versions?query=applicationId:${application.id}&page=0&size=0`)).json()).content;
	const version = versions.find((item: { versionName: string }) => item.versionName === versionName);
	expect(version, `version ${versionName}`).toBeDefined();
	return version.id as number;
}

async function listSuites(page: Page, versionId: number): Promise<Suite[]> {
	const response = await page.request.get(`/private/test_suites?query=appVersionId:${versionId},suiteType:TS_SUITE&size=500&page=0`);
	expect(response.ok()).toBe(true);
	return (await response.json()).content;
}

async function deleteSuitesNamed(page: Page, versionId: number, name: string) {
	for (const suite of (await listSuites(page, versionId)).filter((item) => item.name === name)) {
		expect((await page.request.delete(`/private/test_suites/${suite.id}`)).ok()).toBe(true);
	}
}

async function openTestSuites(page: Page, versionId: number) {
	await hoverNavigation(page, 300);
	await page.getByRole('link', { name: 'Test Suites', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/td/${versionId}/suites$`), { timeout: 30000 });
	await expect(page.getByRole('heading', { name: 'Test Suites', level: 1 })).toBeVisible({ timeout: 30000 });
	await page.mouse.move(1000, 600);
}

// The picker is a full-screen panel rather than a dialog; its left half lists the available test cases.
function testCasePicker(page: Page) {
	return page.locator('div')
		.filter({ has: page.getByText('Add/Remove Test Cases', { exact: true }) })
		.filter({ has: page.getByRole('button', { name: 'Add to Suite', exact: true }) })
		.last();
}

function availableCaseCheckboxes(picker: Locator) {
	return picker.getByRole('grid').first().getByRole('checkbox', { name: /^Select / });
}

async function openCreateTestSuite(page: Page, versionId: number) {
	await page.getByText('Create Test Suite', { exact: true }).first().click();
	await expect(page).toHaveURL(new RegExp(`/td/${versionId}/suites/new$`), { timeout: 30000 });
	await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeDisabled({ timeout: 30000 });
}

async function openTestCasePicker(page: Page) {
	await page.getByText('Add/Remove Test Case', { exact: true }).click();
	const picker = testCasePicker(page);
	await expect(picker.getByText(/^Available Test Cases \(\d+\)$/)).toBeVisible({ timeout: 30000 });
	await expect(availableCaseCheckboxes(picker).first()).toBeVisible({ timeout: 30000 });
	return picker;
}

async function availableCaseCount(picker: Locator) {
	const label = await picker.getByText(/^Available Test Cases \(\d+\)$/).innerText();
	return Number(label.match(/\((\d+)\)/)![1]);
}

// The heading carries a required-field asterisk, e.g. "Test Cases (3)*".
function testCasesHeading(page: Page, count: number) {
	return page.locator('main').getByText(new RegExp(`^Test Cases \\(${count}\\)\\s*\\*?$`));
}

function isSuiteCreate(request: Request) {
	return request.method() === 'POST' && /\/private\/test_suites$/.test(request.url());
}

// The same test cases the picker lists: ready, automated test cases of the version that are not step groups.
async function pickableTestCases(page: Page, versionId: number): Promise<TestCase[]> {
	const query = `status:READY,afterTestParentId:null,deleted:false,isStepGroup:false,isManual:false,applicationVersionId:${versionId},isEligibleForAfterSuite:false`;
	const response = await page.request.get(`/private/test_cases?query=${query}&size=500&page=0`);
	expect(response.ok()).toBe(true);
	return (await response.json()).content.map(({ id, name }: TestCase) => ({ id, name }));
}

// Saves the suite with the test cases added to the form and checks it holds exactly those cases.
async function saveSuite(page: Page, versionId: number, name: string, cases: TestCase[]) {
	await expect(testCasesHeading(page, cases.length)).toBeVisible();
	// The form only draws the rows that fit on screen, in the order the cases were selected.
	const formCases = page.locator('main').getByRole('grid').getByRole('gridcell');
	await expect(formCases.first()).toBeVisible();
	const shownCases = await formCases.allInnerTexts();
	expect(cases.map((testCase) => testCase.name)).toEqual(expect.arrayContaining(shownCases.map((text) => text.trim())));

	const createButton = page.getByRole('button', { name: 'Create', exact: true });
	// A suite needs both a name and at least one test case.
	await expect(createButton).toBeDisabled();
	await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
	await expect(createButton).toBeEnabled();

	const createRequest = page.waitForRequest(isSuiteCreate);
	await createButton.click();
	const request = await createRequest;
	const response = (await request.response())!;
	expect(response.status()).toBe(201);
	const body = request.postDataJSON();
	expect(body).toMatchObject({ name, appVersionId: versionId });
	expect([...body.testCaseIds].sort()).toEqual(cases.map((testCase) => testCase.id).sort());
	const created: Suite = await response.json();
	expect(created).toMatchObject({ name, totalTestCasesCount: cases.length });

	await expect(page.getByText('Test Suite created successfully').first()).toBeVisible();
	await expect(page).toHaveURL(new RegExp(`/td/${versionId}/suites$`), { timeout: 30000 });
	const row = page.getByRole('grid').getByRole('row', { name: new RegExp(`^Select ${escapeRegExp(name)} `) }).last();
	await expect(row.getByRole('link', { name, exact: true })).toHaveAttribute('href', new RegExp(`/suites/${created.id}/cases$`));
	await expect(row.getByRole('gridcell', { name: 'Static', exact: true })).toBeVisible();
	await expect(row.getByRole('gridcell', { name: 'No Runs', exact: true })).toBeVisible();

	// The suite is stored with the chosen test cases.
	const stored = await (await page.request.get(`/private/test_suites/${created.id}`)).json();
	expect(stored).toMatchObject({ name, appVersionId: versionId, totalTestCasesCount: cases.length });
	return created;
}

function escapeRegExp(text: string) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const suiteNames = { allCases: allCasesSuiteName, randomCases: randomCasesSuiteName };
export { projectName, versionName };

// Opens a page of its own, signs in and finds the id of the application's version "1".
export async function openSignedInPage(browser: Browser, { name, type }: SuiteApplication) {
	const page = await browser.newPage();
	page.setDefaultTimeout(15000);
	page.setDefaultNavigationTimeout(30000);
	await signInToTestsigma(page);
	return { page, versionId: await findVersionId(page, name, type) };
}

export async function switchToApplication(page: Page, { name: applicationName }: SuiteApplication, versionId: number) {
	const project = switcherDropdown(page, 'Project');
	const application = switcherDropdown(page, 'Application');
	const version = switcherDropdown(page, 'Version');
	const goToProject = page.getByRole('button', { name: 'Go to project' });
	const quickly = { timeout: 5000 };

	// Dismissing the news-notification prompt closes the switcher, so start over whenever it closes midway.
	await expect(async () => {
		if (!(await project.isVisible())) {
			await hoverNavigation(page, 100);
			await projectSwitcherButton(page).click(quickly);
			await expect(project).toBeVisible(quickly);
		}
		if ((await project.innerText()).trim() !== projectName) {
			await project.click(quickly);
			await page.locator('input[aria-label="Search"]').fill(projectName, quickly);
			await page.getByRole('row', { name: projectName, exact: true }).click(quickly);
			await expect(project).toHaveText(projectName, quickly);
		}
		// Choosing a project selects its first application, so pick the application explicitly.
		if ((await application.innerText()).trim() !== applicationName) {
			await application.click(quickly);
			await page.getByText(applicationName, { exact: true }).last().click(quickly);
			await expect(application).toHaveText(applicationName, quickly);
		}
		if ((await version.innerText()).trim() !== versionName) {
			await version.click(quickly);
			await page.getByRole('row', { name: versionName, exact: true }).click(quickly);
			await expect(version).toHaveText(versionName, quickly);
		}

		// "Go to project" stays disabled when the chosen version is already the current one.
		if (await goToProject.isEnabled()) {
			await goToProject.click(quickly);
			await expect(page).toHaveURL(new RegExp(`/td/${versionId}/cases/filters`), { timeout: 30000 });
		} else {
			await page.keyboard.press('Escape');
		}
	}).toPass({ timeout: 90000 });

	await page.reload();
	await hoverNavigation(page, 100);
	await expect(projectSwitcherButton(page)).toHaveText(projectName, { timeout: 30000 });
	await projectSwitcherButton(page).click();
	await expect(project).toHaveText(projectName);
	await expect(application).toHaveText(applicationName);
	await expect(version).toHaveText(versionName);
	await expect(goToProject).toBeDisabled();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('link', { name: 'Test Suites', exact: true })).toHaveAttribute('href', `/ui/td/${versionId}/suites`);
}

export async function verifyTestSuitesPage(page: Page, versionId: number) {
	// Start from suites this run creates being absent, so the page and names are predictable.
	await deleteSuitesNamed(page, versionId, allCasesSuiteName);
	await deleteSuitesNamed(page, versionId, randomCasesSuiteName);
	await openTestSuites(page, versionId);

	const main = page.locator('main');
	await expect(main.getByText('Create Test Suite', { exact: true }).first()).toBeVisible();
	const suites = await listSuites(page, versionId);
	if (suites.length === 0) {
		await expect(main.getByText('No Suites have been created', { exact: true })).toBeVisible();
		await expect(main.getByRole('img', { name: 'Empty state illustration' })).toBeVisible();
	} else {
		await expect(main.getByRole('textbox', { name: 'Search' })).toBeVisible();
		await expect(main.getByText(`All (${suites.length})`, { exact: true })).toBeVisible();
		await expect(main.getByText('Show Filters', { exact: true })).toBeVisible();
		await expect(main.getByText('Sort by', { exact: true })).toBeVisible();
		for (const column of ['Title', 'Type', 'Created', 'Created by', 'Status']) {
			await expect(main.getByText(column, { exact: true }).first()).toBeVisible();
		}
		await expect(main.getByRole('grid').getByRole('link', { name: suites[0].name, exact: true })).toBeVisible();
	}
}

export async function verifyCreateFormAndPicker(page: Page, { name: applicationName }: SuiteApplication, versionId: number) {
	await openTestSuites(page, versionId);
	await openCreateTestSuite(page, versionId);
	const main = page.locator('main');
	await expect(main.getByText('Create Test Suite', { exact: true })).toBeVisible();
	await expect(main.getByRole('link', { name: 'Help' })).toHaveAttribute('href', /testsigma\.com\/docs\/test-management\/test-suites/);
	await expect(main.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
	await expect(main.getByText('Basic Details', { exact: true })).toBeVisible();
	await expect(main.getByRole('textbox', { name: 'Name', exact: true })).toBeEmpty();
	await expect(main.getByRole('checkbox', { name: 'Description' })).not.toBeChecked();
	await expect(main.getByText('Pre-Requisite', { exact: true })).toBeVisible();
	await expect(main.getByText('None', { exact: true })).toBeVisible();
	await expect(main.getByRole('textbox', { name: 'Add Label' })).toBeVisible();
	await expect(testCasesHeading(page, 0)).toBeVisible();
	await expect(main.getByText('Add/Remove Test Case', { exact: true })).toBeVisible();
	await expect(main.getByRole('checkbox', { name: 'AfterTest Suite' })).not.toBeChecked();

	// A name alone is not enough to create a suite.
	await main.getByRole('textbox', { name: 'Name', exact: true }).fill('Suite without test cases');
	await expect(main.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();

	const picker = await openTestCasePicker(page);
	const total = await availableCaseCount(picker);
	expect(total, `${applicationName} version ${versionName} has no ready, automated test cases`).toBeGreaterThanOrEqual(1);
	await expect(picker.getByText(`All (${total})`, { exact: true }).first()).toBeVisible();
	await expect(picker.getByText('Saved Filters', { exact: true }).first()).toBeVisible();
	await expect(picker.getByText('Show Filters', { exact: true }).first()).toBeVisible();
	await expect(picker.getByText('Sort by', { exact: true })).toBeVisible();
	// The search box stays collapsed until its icon is clicked.
	await picker.getByTestId('search').first().click();
	await expect(picker.getByRole('textbox', { name: 'Search' })).toBeVisible();
	await expect(picker.getByText('Selected for Test Suite (0)', { exact: true })).toBeVisible();
	await expect(picker.getByText('No Test Case has been added to this suite', { exact: true })).toBeVisible();
	await expect(picker.getByRole('button', { name: 'Select', exact: true })).toBeDisabled();
	await expect(picker.getByRole('button', { name: 'Remove', exact: true })).toBeDisabled();
	await expect(picker.getByRole('button', { name: 'Add to Suite', exact: true })).toBeDisabled();

	// Checking a test case enables moving it; Remove moves it back.
	await availableCaseCheckboxes(picker).first().check();
	await expect(picker.getByRole('button', { name: 'Select', exact: true })).toBeEnabled();
	await picker.getByRole('button', { name: 'Select', exact: true }).click();
	await expect(picker.getByText('Selected for Test Suite (1)', { exact: true })).toBeVisible();
	await expect(picker.getByRole('button', { name: 'Add to Suite', exact: true })).toBeEnabled();
	await picker.getByRole('grid').last().getByRole('checkbox', { name: /^Select / }).first().check();
	await picker.getByRole('button', { name: 'Remove', exact: true }).click();
	await expect(picker.getByText('Selected for Test Suite (0)', { exact: true })).toBeVisible();

	// Leaving the picker and the form saves nothing.
	await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(picker.getByText('Add/Remove Test Cases', { exact: true })).toBeHidden();
	await expect(testCasesHeading(page, 0)).toBeVisible();
	await main.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/td/${versionId}/suites$`), { timeout: 30000 });
	expect((await listSuites(page, versionId)).map((suite) => suite.name)).not.toContain('Suite without test cases');
}

export async function createSuiteWithAllCases(page: Page, versionId: number) {
	await openTestSuites(page, versionId);
	await openCreateTestSuite(page, versionId);
	const picker = await openTestCasePicker(page);
	const cases = await pickableTestCases(page, versionId);
	await expect(picker.getByText(`Available Test Cases (${cases.length})`, { exact: true })).toBeVisible();

	await picker.getByRole('checkbox', { name: 'Select All', exact: true }).first().check();
	// The list only draws the rows that fit on screen; each drawn row is checked.
	for (const checkbox of await availableCaseCheckboxes(picker).all()) {
		await expect(checkbox).toBeChecked();
	}
	await picker.getByRole('button', { name: 'Select', exact: true }).click();
	await expect(picker.getByText(`Selected for Test Suite (${cases.length})`, { exact: true })).toBeVisible();
	await picker.getByRole('button', { name: 'Add to Suite', exact: true }).click();
	await expect(picker.getByText('Add/Remove Test Cases', { exact: true })).toBeHidden();

	await saveSuite(page, versionId, allCasesSuiteName, cases);
}

export async function createSuiteWithRandomCases(page: Page, { name: applicationName }: SuiteApplication, versionId: number) {
	await openTestSuites(page, versionId);
	await openCreateTestSuite(page, versionId);
	const picker = await openTestCasePicker(page);
	const available = await pickableTestCases(page, versionId);
	expect(available.length, `${applicationName} version ${versionName} needs at least 5 ready, automated test cases to pick from`).toBeGreaterThanOrEqual(5);
	const count = 4 + Math.floor(Math.random() * 2);
	const chosen = [...available].sort(() => Math.random() - 0.5).slice(0, count);
	test.info().annotations.push({ type: 'Selected test cases', description: chosen.map((testCase) => testCase.name).join(', ') });

	// The list only draws the rows that fit on screen, so search for each chosen case and move it across.
	// Once a case is selected the right-hand list gets a search box too; the left one comes first.
	await picker.getByTestId('search').first().click();
	const search = picker.getByRole('textbox', { name: 'Search' }).first();
	for (const [index, testCase] of chosen.entries()) {
		await search.fill(testCase.name);
		const checkbox = availableCaseCheckboxes(picker).and(picker.getByRole('checkbox', { name: `Select ${testCase.name}`, exact: true }));
		await expect(checkbox).toBeVisible();
		await checkbox.check();
		await picker.getByRole('button', { name: 'Select', exact: true }).click();
		await expect(picker.getByText(`Selected for Test Suite (${index + 1})`, { exact: true })).toBeVisible();
	}
	await search.clear();
	await expect(picker.getByText(`Available Test Cases (${available.length})`, { exact: true })).toBeVisible();
	await picker.getByRole('button', { name: 'Add to Suite', exact: true }).click();
	await expect(picker.getByText('Add/Remove Test Cases', { exact: true })).toBeHidden();

	await saveSuite(page, versionId, randomCasesSuiteName, chosen);
	// Both suites of this run are listed, and the list view has its search, filters and columns.
	const main = page.locator('main');
	for (const name of [allCasesSuiteName, randomCasesSuiteName]) {
		await expect(main.getByRole('grid').getByRole('link', { name, exact: true })).toHaveCount(1);
	}
	const suiteCount = (await listSuites(page, versionId)).length;
	await expect(main.getByText(`All (${suiteCount})`, { exact: true })).toBeVisible();
	await expect(main.getByRole('textbox', { name: 'Search' })).toBeVisible();
	await expect(main.getByText('Show Filters', { exact: true })).toBeVisible();
	await expect(main.getByText('Sort by', { exact: true })).toBeVisible();
	await expect(main.getByRole('checkbox', { name: 'Select All', exact: true })).toBeVisible();
	for (const column of ['Title', 'Type', 'Created', 'Created by', 'Status']) {
		await expect(main.getByText(column, { exact: true }).first()).toBeVisible();
	}

	// Searching narrows the list to the matching suite.
	await main.getByRole('textbox', { name: 'Search' }).fill('Test Suite 2');
	await expect(main.getByRole('grid').getByRole('link', { name: randomCasesSuiteName, exact: true })).toBeVisible();
	await expect(main.getByRole('grid').getByRole('link', { name: allCasesSuiteName, exact: true })).toHaveCount(0);
	await main.getByRole('textbox', { name: 'Search' }).clear();
	await expect(main.getByRole('grid').getByRole('link', { name: allCasesSuiteName, exact: true })).toBeVisible();
}
