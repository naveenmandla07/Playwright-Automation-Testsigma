import path from 'node:path';
import { expect, test, type Locator, type Page, type Response } from '@playwright/test';

const email = process.env.TESTSIGMA_EMAIL;
const password = process.env.TESTSIGMA_PASSWORD;

const runId = Date.now();
const folderName = `PW_TDP_Folder_${runId}`;
const renamedFolderName = `${folderName}_Renamed`;
const subFolderName = `PW_TDP_SubFolder_${runId}`;
const renamedSubFolderName = `${subFolderName}_Renamed`;

const profileName = `PW_TDP_${runId}`;
const updatedProfileName = `${profileName}_Updated`;
const parameters = ['username', 'password'];
const dataSets = [
	['set_one', 'user_one', 'pass_one'],
	['set_two', 'user_two', 'pass_two'],
];
const renamedParameters = ['login_username', 'password'];
const updatedDataSets = [
	['set_one_renamed', 'user_one_updated', 'pass_one'],
	['set_two', 'user_two', 'pass_two'],
	['set_three', 'user_three', 'pass_three'],
];

const importFile = path.join(__dirname, 'test-data', 'PW_TDP_Import.xlsx');
const importedProfileName = `PW_TDP_Imported_${runId}`;
// The import turns every sheet column after Name and ExpectedToFail into a parameter, including Description.
const importedParameters = ['Description', 'username', 'password'];
const importedDataSets = [
	['import_set_one', 'First imported set', 'import_user_one', 'import_pass_one'],
	['import_set_two', 'Second imported set', 'import_user_two', 'import_pass_two'],
];

// The news-notification prompt can appear at any point after sign-in and blocks clicks until dismissed.
async function dismissNewsNotificationWhenShown(page: Page) {
	await page.addLocatorHandler(page.locator('#beamerPushModal'), async (modal) => {
		await modal.getByRole('button', { name: /no,? thanks/i }).or(modal.getByText(/no,? thanks/i)).first().click();
	});
}

async function signIn(page: Page) {
	await page.goto('./');
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

	await page.getByPlaceholder('name@company.com').fill(email!);
	await page.getByPlaceholder('Enter Password').fill(password!);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await page.waitForURL(/\/ui\/v2\//, { timeout: 30000 });
	await expect(page.getByRole('button', { name: 'Share Feedback' })).toBeVisible({ timeout: 30000 });
}

async function openTestDataProfiles(page: Page) {
	// The side navigation only shows labels while hovered.
	await page.mouse.move(20, 300);
	await page.getByRole('button', { name: 'Test Data', exact: true }).click();
	await page.getByRole('link', { name: 'Test Data Profiles' }).click();
	await expect(page).toHaveURL(/\/data\/folders$/, { timeout: 30000 });
	await expect(page.getByRole('heading', { name: 'Select or Create Test Data Profile to manage your test data' })).toBeVisible({ timeout: 30000 });
}

async function reloadTestDataProfiles(page: Page) {
	await page.goto(page.url().replace(/\/data\/folders.*$/, '/data/folders'));
	await expect(page.getByRole('tree')).toBeVisible({ timeout: 30000 });
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Folder rows are named after the folder plus an item count once it has children, e.g. "Feature (2)".
function treeFolder(page: Page, name: string) {
	return page.getByRole('tree').getByRole('button', { name: new RegExp(`^${escapeRegExp(name)}( \\(\\d+\\))?$`) });
}

function treeProfile(page: Page, name: string) {
	return page.getByRole('tree').getByRole('link', { name, exact: true });
}

async function expandFolder(folder: Locator) {
	await expect(folder).toBeVisible();
	if (await folder.getAttribute('aria-expanded') !== 'true') {
		await folder.click();
	}
	await expect(folder).toHaveAttribute('aria-expanded', 'true');
}

async function openFolderMenu(page: Page, folder: Locator, option: string) {
	const menuOption = page.getByText(option, { exact: true });
	// The options icon only appears on hover, and a tree refresh can close or re-render the menu while it is being clicked.
	await expect(async () => {
		await folder.hover();
		await folder.getByTestId('more-vertical').click();
		await expect(menuOption).toBeVisible({ timeout: 2000 });
		await menuOption.click({ timeout: 2000 });
	}).toPass({ timeout: 30000 });
}

async function submitFolderDialog(page: Page, heading: string, name: string, submit: string) {
	const dialog = page.getByRole('dialog').filter({ hasText: heading });
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

async function createFolder(page: Page, name: string, parent?: Locator) {
	const createResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/private\/test_data\/folders$/.test(response.url()));
	if (parent) {
		await openFolderMenu(page, parent, 'Add Sub Folder');
	} else {
		await page.getByRole('button', { name: 'Add Folder' }).click();
		await page.getByText('Add Folder', { exact: true }).last().click();
	}
	await submitFolderDialog(page, 'Add Folder', name, 'Create');
	const created = await (await createResponse).json();
	expect(created.name).toBe(name);
	await expect(page.getByText('Folder added successfully').first()).toBeVisible();
	return created as { id: number; parentId: number | null };
}

async function renameFolder(page: Page, currentName: string, newName: string) {
	await openFolderMenu(page, treeFolder(page, currentName), 'Rename');
	await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Enter folder name' })).toHaveValue(currentName);
	const renameResponse = page.waitForResponse((response) => response.request().method() === 'PUT' && /\/private\/test_data\/folders\/\d+$/.test(response.url()));
	await submitFolderDialog(page, 'Rename Folder', newName, 'Save');
	expect((await (await renameResponse).json()).name).toBe(newName);
	await expect(page.getByText('Folder updated successfully').first()).toBeVisible();
	await expect(treeFolder(page, newName)).toBeVisible();
	await expect(treeFolder(page, currentName)).toBeHidden();
}

async function expectSubFolder(page: Page, parentName: string, childName: string) {
	const parent = treeFolder(page, parentName);
	await expandFolder(parent);
	const child = treeFolder(page, childName);
	await expect(child).toBeVisible();
	const parentLevel = Number(await parent.getAttribute('aria-level'));
	await expect(child).toHaveAttribute('aria-level', String(parentLevel + 1));
	await expect(parent).toHaveAccessibleName(`${parentName} (1)`);
}

function dataSetRows(page: Page) {
	return page.getByRole('table').getByRole('rowgroup').nth(1).getByRole('row');
}

// The grid's "+" buttons have no accessible name, only a tooltip: the first adds a column, the last adds a row.
function addColumnButton(page: Page) {
	return page.locator('main span.popper__reference > div.text-white').first();
}

function addRowButton(page: Page) {
	return page.locator('main span.popper__reference > div.text-white').last();
}

// Cells 0 and 1 are S.No. and ETF, so the Set Name is cell 2 and parameters follow it.
async function fillDataSet(page: Page, row: Locator, values: string[]) {
	const cells = row.getByRole('cell');
	for (const [index, value] of values.entries()) {
		const cell = cells.nth(index + 2).getByRole('textbox');
		// The grid re-renders after each edit and can drop a value typed mid-render, so re-enter it until it sticks.
		await expect(async () => {
			await cell.click();
			await page.keyboard.press('ControlOrMeta+A');
			await page.keyboard.type(value);
			await cells.first().click();
			await page.waitForTimeout(500);
			expect(await cell.inputValue()).toBe(value);
		}).toPass({ timeout: 20000 });
	}
}

async function renameColumn(page: Page, currentName: string, newName: string) {
	const header = page.getByRole('columnheader', { name: currentName, exact: true });
	await header.dblclick();
	await header.getByRole('textbox').fill(newName);
	await page.keyboard.press('Enter');
	await expect(page.getByRole('columnheader', { name: newName, exact: true })).toBeVisible();
}

// The info panel holds the Name field; on narrow viewports it squeezes the grid until sticky columns cover the
// parameter cells and headers, so keep it closed while editing the grid.
async function setInfoPanel(page: Page, open: boolean) {
	const panelTitle = page.getByText('Test Data Profile Info', { exact: true });
	if (await panelTitle.isVisible() === open) return;
	await (open ? page.locator('main [data-testid="info"]').last() : page.locator('main').getByTestId('close')).click();
	await expect(panelTitle).toBeVisible({ visible: open });
}

// The grid can show a typed value it has not stored and then refuses to save ("Test data set name is missing...").
// When no save request follows the click, retype every data set and try again.
async function saveDataSets(page: Page, saveButton: Locator, values: string[][], isSaveRequest: (response: Response) => boolean) {
	for (let attempt = 1; ; attempt++) {
		const saveResponse = page.waitForResponse(isSaveRequest, { timeout: 10000 }).catch(() => undefined);
		await saveButton.click();
		const response = await saveResponse;
		if (response) return response;
		if (attempt === 3) throw new Error(`The test data profile was not saved after ${attempt} attempts.`);

		const infoPanelOpen = await page.getByText('Test Data Profile Info', { exact: true }).isVisible();
		await setInfoPanel(page, false);
		for (const [index, rowValues] of values.entries()) {
			await fillDataSet(page, dataSetRows(page).nth(index), rowValues);
		}
		await setInfoPanel(page, infoPanelOpen);
	}
}

async function expectDataSets(page: Page, expected: string[][]) {
	const rows = dataSetRows(page);
	await expect(rows).toHaveCount(expected.length);
	for (const [rowIndex, values] of expected.entries()) {
		const cells = rows.nth(rowIndex).getByRole('cell');
		await expect(cells.first()).toHaveText(String(rowIndex + 1).padStart(2, '0'));
		for (const [index, value] of values.entries()) {
			await expect(cells.nth(index + 2).getByRole('textbox')).toHaveValue(value);
		}
	}
}

async function expectColumns(page: Page, expected: string[]) {
	await expect(page.getByRole('table').getByRole('columnheader')).toHaveText(['S.No.', 'ETF', 'Set Name', ...expected]);
}

function profileTitle(page: Page, name: string) {
	return page.locator('main').getByText(name, { exact: true }).last();
}

async function openProfile(page: Page, name: string) {
	await treeProfile(page, name).click();
	await expect(page).toHaveURL(/\/data\/folders\/\d+\/sets$/, { timeout: 30000 });
	await expect(profileTitle(page, name)).toBeVisible({ timeout: 30000 });
	return Number(page.url().match(/\/data\/folders\/(\d+)\/sets$/)![1]);
}

async function deleteProfile(page: Page, name: string, id: number) {
	await page.getByRole('button', { name: 'Delete', exact: true }).click();

	const dialog = page.getByRole('dialog');
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
	const deleteResponse = page.waitForResponse((response) => response.request().method() === 'DELETE' && response.url().includes(`/private/test_data/${id}`));
	await confirmButton.click();
	expect((await deleteResponse).ok()).toBe(true);

	await expect(page).toHaveURL(/\/data\/folders$/, { timeout: 30000 });
	await expect(treeProfile(page, name)).toBeHidden();

	await page.goto(page.url().replace(/\/data\/folders$/, `/data/folders/${id}/sets`));
	await expect(page.getByText(`Test Data Not Found with id: ${id}`)).toBeVisible({ timeout: 30000 });
}

test.describe('Verify the CRUD operations of Test Data Profile', () => {
	test.describe.configure({ mode: 'serial', timeout: 180000 });
	test.skip(!email || !password, 'Set TESTSIGMA_EMAIL and TESTSIGMA_PASSWORD in .env to run this test.');

	let page: Page;
	let folderId: number | undefined;
	let subFolderId: number | undefined;
	let versionId: number | undefined;
	const profileIds: Record<string, number | undefined> = {};

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		page.setDefaultTimeout(15000);
		page.setDefaultNavigationTimeout(30000);
		await dismissNewsNotificationWhenShown(page);
		await signIn(page);
		await openTestDataProfiles(page);
	});

	test.afterAll(async () => {
		// Remove anything a failed test left behind. Profiles go first: deleting a folder leaves the profiles in its
		// subfolders behind.
		for (const id of Object.values(profileIds)) {
			if (id) await page.request.delete(`/private/test_data/${id}?applicationVersionId=${versionId ?? 1}`).catch(() => {});
		}
		for (const id of [subFolderId, folderId]) {
			if (id) await page.request.delete(`/private/test_data/folders/${id}`).catch(() => {});
		}
		await page.close();
	});

	test('Create a folder and a subfolder', async () => {
		const folder = await createFolder(page, folderName);
		folderId = folder.id;
		expect(folder.parentId).toBeNull();
		await expect(treeFolder(page, folderName)).toBeVisible();

		const subFolder = await createFolder(page, subFolderName, treeFolder(page, folderName));
		subFolderId = subFolder.id;
		expect(subFolder.parentId).toBe(folderId);

		await reloadTestDataProfiles(page);
		await expectSubFolder(page, folderName, subFolderName);
	});

	test('Rename the folder and the subfolder', async () => {
		await renameFolder(page, folderName, renamedFolderName);
		await expandFolder(treeFolder(page, renamedFolderName));
		await renameFolder(page, subFolderName, renamedSubFolderName);

		await reloadTestDataProfiles(page);
		await expectSubFolder(page, renamedFolderName, renamedSubFolderName);
		await expect(treeFolder(page, folderName)).toBeHidden();
		await expect(treeFolder(page, subFolderName)).toBeHidden();
	});

	test('Create a test data profile in the subfolder', async () => {
		await expectSubFolder(page, renamedFolderName, renamedSubFolderName);
		await openFolderMenu(page, treeFolder(page, renamedSubFolderName), 'New Test Data Profile');

		await expect(page).toHaveURL(new RegExp(`/data/folders/new\\?folderId=${subFolderId}$`));
		const createButton = page.getByRole('button', { name: 'Create', exact: true });
		await expect(page.getByText('Untitled', { exact: true })).toBeVisible();
		await expect(createButton).toBeEnabled();
		await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
		await expectColumns(page, ['Parameter 1']);
		await expect(dataSetRows(page)).toHaveCount(1);

		await setInfoPanel(page, false);
		await addColumnButton(page).click();
		await expect(page.getByRole('columnheader', { name: 'Parameter 2', exact: true })).toBeVisible();
		await fillDataSet(page, dataSetRows(page).nth(0), dataSets[0]);
		await addRowButton(page).click();
		await expect(dataSetRows(page)).toHaveCount(2);
		await fillDataSet(page, dataSetRows(page).nth(1), dataSets[1]);

		// Rename the columns after entering values; renaming first makes the grid drop typed values.
		for (const [index, parameter] of parameters.entries()) {
			await renameColumn(page, `Parameter ${index + 1}`, parameter);
		}
		await expectColumns(page, parameters);
		await expectDataSets(page, dataSets);

		await setInfoPanel(page, true);
		const nameField = page.getByRole('textbox', { name: 'Name' });
		await expect(nameField).toBeEmpty();
		await nameField.fill(profileName);
		await expect(nameField).toHaveValue(profileName);

		const createResponse = await saveDataSets(page, createButton, dataSets, (response) => response.request().method() === 'POST' && /\/private\/test_data$/.test(response.url()));
		const created = await createResponse.json();
		expect(created.testDataName).toBe(profileName);
		expect(created.columns).toEqual(parameters);
		expect(created.testDataFolderId).toBe(subFolderId);
		profileIds[profileName] = created.id;
		versionId = created.versionId;

		await expect(page).toHaveURL(new RegExp(`/data/folders/${created.id}/sets$`), { timeout: 30000 });
	});

	test('Read the created test data profile after a reload', async () => {
		await page.reload();
		await expect(profileTitle(page, profileName)).toBeVisible({ timeout: 30000 });
		await expect(treeProfile(page, profileName)).toBeVisible();
		await expect(treeFolder(page, renamedSubFolderName)).toHaveAccessibleName(`${renamedSubFolderName} (1)`);
		await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeEnabled();
		await expectColumns(page, parameters);
		await expectDataSets(page, dataSets);

		await setInfoPanel(page, true);
		await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(profileName);

		const search = page.locator('main').getByRole('textbox', { name: 'Search' }).first();
		await search.fill(profileName);
		await expect(treeProfile(page, profileName)).toBeVisible();
		await search.clear();
	});

	test('Update the profile name, column name, set name and data sets', async () => {
		const profileId = profileIds[profileName];
		const renameResponse = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().includes(`/private/test_data/${profileId}`));
		const nameField = page.getByRole('textbox', { name: 'Name' });
		await nameField.fill(updatedProfileName);
		// The name is saved when the field loses focus.
		await nameField.press('Tab');
		expect((await renameResponse).ok()).toBe(true);
		await expect(page.getByText('Test Data Profile updated successfully')).toBeVisible();
		await expect(treeProfile(page, updatedProfileName)).toBeVisible();

		await setInfoPanel(page, false);
		await renameColumn(page, parameters[0], renamedParameters[0]);
		await fillDataSet(page, dataSetRows(page).nth(0), updatedDataSets[0].slice(0, 2));
		await addRowButton(page).click();
		await expect(dataSetRows(page)).toHaveCount(3);
		await fillDataSet(page, dataSetRows(page).nth(2), updatedDataSets[2]);
		await expectColumns(page, renamedParameters);
		await expectDataSets(page, updatedDataSets);

		// Unsaved grid edits replace the "Update" (import) icon with a text "Update" button that saves them.
		const saveButton = page.getByRole('button').filter({ hasText: /^Update$/ });
		await expect(saveButton).toBeEnabled();
		const updateResponse = await saveDataSets(page, saveButton, updatedDataSets, (response) => response.request().method() === 'PUT' && response.url().includes(`/private/test_data/${profileId}`));
		const updated = await updateResponse.json();
		expect(updated.testDataName).toBe(updatedProfileName);
		expect(updated.columns).toEqual(renamedParameters);
		await expect(saveButton).toBeHidden();

		await page.reload();
		await expect(profileTitle(page, updatedProfileName)).toBeVisible({ timeout: 30000 });
		await expect(treeProfile(page, profileName)).toBeHidden();
		await expectColumns(page, renamedParameters);
		await expectDataSets(page, updatedDataSets);
	});

	test('Create a test data profile by importing an Excel file into the subfolder', async () => {
		await page.getByRole('button', { name: 'List View' }).click();
		await expect(page.getByText('Create Test Data Profile', { exact: true })).toBeVisible({ timeout: 30000 });
		await page.getByRole('button', { name: 'Import', exact: true }).click();

		const locationDialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Select Location' }) });
		const confirmButton = locationDialog.getByRole('button', { name: 'Confirm', exact: true });
		await expect(locationDialog.getByText('None', { exact: true })).toBeVisible();
		await expect(confirmButton).toBeDisabled();
		await locationDialog.getByRole('treeitem', { name: renamedFolderName, exact: true }).click();
		await locationDialog.getByRole('treeitem', { name: renamedSubFolderName, exact: true }).click();
		await expect(locationDialog).toContainText(`Target Scenario${renamedFolderName}/${renamedSubFolderName}`);
		await expect(confirmButton).toBeEnabled();
		await confirmButton.click();

		const importDialog = page.getByRole('dialog').filter({ hasText: 'Import Test Data Profile' });
		const importButton = importDialog.getByRole('button', { name: 'Import', exact: true });
		await expect(importDialog.getByText('Supported file format - MS Excel Sheet')).toBeVisible();
		await expect(importDialog.getByRole('link', { name: 'Sample TDP File' })).toBeVisible();
		await expect(importButton).toBeDisabled();

		const fieldNamesResponse = page.waitForResponse((response) => response.url().includes('/private/test_data/import_field_names'));
		await page.getByTestId('dnd-file-uploader-input').setInputFiles(importFile);
		const { fieldNames } = await (await fieldNamesResponse).json();
		expect(fieldNames).toEqual(['Name', 'Description', 'ExpectedToFail', 'username', 'password']);
		await expect(importDialog.getByText(path.basename(importFile), { exact: true })).toBeVisible();
		await expect(importDialog.getByText('Do you want to encrypt any of the columns?')).toBeVisible();
		for (const parameter of importedParameters) {
			await expect(importDialog.getByText(parameter, { exact: true })).toBeVisible();
		}
		await expect(importButton).toBeDisabled();

		await importDialog.getByRole('textbox', { name: 'Name' }).fill(importedProfileName);
		await expect(importButton).toBeEnabled();
		const importResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/private/test_data/import?'));
		await importButton.click();
		const imported = await importResponse;
		expect(imported.ok()).toBe(true);
		const importParams = new URL(imported.url()).searchParams;
		expect(importParams.get('name')).toBe(importedProfileName);
		expect(importParams.get('testDataFolderId')).toBe(String(subFolderId));
		await expect(importDialog).toBeHidden();

		// The tree only shows the imported profile after it is reloaded.
		await reloadTestDataProfiles(page);
		await expectSubFolder(page, renamedFolderName, renamedSubFolderName);
		await expandFolder(treeFolder(page, renamedSubFolderName));
		await expect(treeFolder(page, renamedSubFolderName)).toHaveAccessibleName(`${renamedSubFolderName} (2)`);
		profileIds[importedProfileName] = await openProfile(page, importedProfileName);

		await expectColumns(page, importedParameters);
		await expectDataSets(page, importedDataSets);
		// ExpectedToFail YES/NO in the sheet maps to the ETF toggle.
		await expect(dataSetRows(page).nth(0).getByRole('checkbox')).toBeChecked();
		await expect(dataSetRows(page).nth(1).getByRole('checkbox')).not.toBeChecked();
	});

	test('Delete the test data profiles, the subfolder and the folder', async () => {
		await deleteProfile(page, importedProfileName, profileIds[importedProfileName]!);
		profileIds[importedProfileName] = undefined;

		await reloadTestDataProfiles(page);
		await expectSubFolder(page, renamedFolderName, renamedSubFolderName);
		await expandFolder(treeFolder(page, renamedSubFolderName));
		await openProfile(page, updatedProfileName);
		await deleteProfile(page, updatedProfileName, profileIds[profileName]!);
		profileIds[profileName] = undefined;

		await reloadTestDataProfiles(page);
		await expandFolder(treeFolder(page, renamedFolderName));
		await expect(treeFolder(page, renamedSubFolderName)).toHaveAccessibleName(renamedSubFolderName);

		await openFolderMenu(page, treeFolder(page, renamedFolderName), 'Delete');
		const dialog = page.getByRole('dialog').filter({ hasText: 'Delete Folder' });
		await expect(dialog).toContainText(`Are you sure you want to delete "${renamedFolderName}"? This action cannot be undone.`);
		await expect(dialog).toContainText('This folder contains 1 item(s). Deleting it will also delete all its contents.');
		await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
		const deleteResponse = page.waitForResponse((response) => response.request().method() === 'DELETE' && response.url().includes(`/private/test_data/folders/${folderId}`));
		await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
		expect((await deleteResponse).ok()).toBe(true);
		await expect(page.getByText('Folder deleted successfully')).toBeVisible();

		await reloadTestDataProfiles(page);
		await expect(treeFolder(page, renamedFolderName)).toBeHidden();
		await expect(treeFolder(page, renamedSubFolderName)).toBeHidden();
		for (const id of [folderId, subFolderId]) {
			expect((await page.request.get(`/private/test_data/folders/${id}`)).status()).toBe(404);
		}
		folderId = undefined;
		subFolderId = undefined;
	});
});

test.describe('Verify folder deletion removes nested test data profiles', () => {
	test.skip(!email || !password, 'Set TESTSIGMA_EMAIL and TESTSIGMA_PASSWORD in .env to run this test.');

	test('Deleting a folder deletes the test data profiles in its subfolders', async ({ page }) => {
		// Remove this once Testsigma fixes the bug; the test then fails as "expected to fail but passed".
		test.fail(true, 'Testsigma bug: deleting a folder leaves the test data profiles in its subfolders behind.');
		test.setTimeout(120000);
		page.setDefaultTimeout(15000);
		page.setDefaultNavigationTimeout(30000);
		await dismissNewsNotificationWhenShown(page);
		await signIn(page);
		await openTestDataProfiles(page);

		const versionId = Number(page.url().match(/\/td\/(\d+)\//)![1]);
		const parentName = `PW_TDP_DeleteFolder_${runId}`;
		const childName = `PW_TDP_DeleteSubFolder_${runId}`;
		const nestedProfileName = `PW_TDP_Nested_${runId}`;
		let parentId: number | undefined;
		let childId: number | undefined;
		let nestedProfileId: number | undefined;

		try {
			// Only the folder deletion is under test, so create its contents through the API.
			const parent = await page.request.post('/private/test_data/folders', { data: { name: parentName, versionId, parentId: null, type: 'FEATURE' } });
			expect(parent.ok()).toBe(true);
			parentId = (await parent.json()).id;
			const child = await page.request.post('/private/test_data/folders', { data: { name: childName, versionId, parentId, type: 'SCENARIO' } });
			expect(child.ok()).toBe(true);
			childId = (await child.json()).id;
			const profile = await page.request.post('/private/test_data', {
				data: {
					createType: 'MANUAL',
					data: [{ selected: false, expectedToFail: false, name: 'nested_set', data: { username: 'nested_user' } }],
					passwords: [],
					columns: ['username'],
					renamedColumns: {},
					name: nestedProfileName,
					testDataName: nestedProfileName,
					versionId: String(versionId),
					testDataFolderId: childId,
				},
			});
			expect(profile.ok()).toBe(true);
			nestedProfileId = (await profile.json()).id;

			await reloadTestDataProfiles(page);
			await expectSubFolder(page, parentName, childName);
			await expandFolder(treeFolder(page, childName));
			await expect(treeProfile(page, nestedProfileName)).toBeVisible();

			await openFolderMenu(page, treeFolder(page, parentName), 'Delete');
			const dialog = page.getByRole('dialog').filter({ hasText: 'Delete Folder' });
			await expect(dialog).toContainText(`Are you sure you want to delete "${parentName}"? This action cannot be undone.`);
			await expect(dialog).toContainText('Deleting it will also delete all its contents.');
			const deleteResponse = page.waitForResponse((response) => response.request().method() === 'DELETE' && response.url().includes(`/private/test_data/folders/${parentId}`));
			await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
			expect((await deleteResponse).ok()).toBe(true);
			await expect(page.getByText('Folder deleted successfully')).toBeVisible();

			await reloadTestDataProfiles(page);
			await expect(treeFolder(page, parentName)).toBeHidden();
			expect((await page.request.get(`/private/test_data/folders/${childId}`)).status()).toBe(404);
			expect((await page.request.get(`/private/test_data/${nestedProfileId}`)).status(), 'The profile in the subfolder should be deleted with the folder').toBe(404);
		} finally {
			if (nestedProfileId) await page.request.delete(`/private/test_data/${nestedProfileId}?applicationVersionId=${versionId}`).catch(() => {});
			for (const id of [childId, parentId]) {
				if (id) await page.request.delete(`/private/test_data/folders/${id}`).catch(() => {});
			}
		}
	});
});
