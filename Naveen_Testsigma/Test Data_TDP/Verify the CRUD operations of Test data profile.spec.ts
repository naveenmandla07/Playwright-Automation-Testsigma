/**
 * Creating, reading, updating and deleting test data profiles and their folders.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Create a folder with a subfolder, then rename both.
 * - Create a test data profile in the subfolder, filling its grid with columns and data sets.
 * - Read the profile back after a reload.
 * - Update the profile name, a column name, a data set name and the data set values.
 * - Create a second profile by importing an Excel file, checking its columns become parameters and its
 *   ExpectedToFail values map to the ETF toggle.
 * - Delete both profiles, the subfolder and the folder.
 *
 * A separate test deletes a folder that has profiles in its subfolders. It is marked as expected to fail
 * because of a Testsigma bug that leaves those profiles behind; remove test.fail once the bug is fixed.
 *
 * Every name carries the run id, and anything a failed run leaves behind is removed afterwards.
 */
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { TestDataApi } from '../pages/test-data/TestDataApi';
import { ImportProfileDialog, SelectLocationDialog, TestDataProfileEditor, TestDataProfilesPage } from '../pages/test-data/TestDataProfilesPage';
import { missingCredentials, missingCredentialsMessage, signInToTestsigma } from '../support/testsigma-auth';

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

test.describe('Verify the CRUD operations of Test Data Profile', () => {
	test.describe.configure({ mode: 'serial', timeout: 180000 });
	test.skip(missingCredentials, missingCredentialsMessage);

	let page: Page;
	let api: TestDataApi;
	let profiles: TestDataProfilesPage;
	let editor: TestDataProfileEditor;
	let folderId: number | undefined;
	let subFolderId: number | undefined;
	let versionId: number | undefined;
	const profileIds: Record<string, number | undefined> = {};

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		page.setDefaultTimeout(15000);
		page.setDefaultNavigationTimeout(30000);
		await signInToTestsigma(page);
		api = new TestDataApi(page);
		profiles = new TestDataProfilesPage(page);
		editor = new TestDataProfileEditor(page);
		await profiles.openFromNavigation();
	});

	test.afterAll(async () => {
		// Remove anything a failed test left behind. Profiles go first: deleting a folder leaves the profiles in its
		// subfolders behind.
		for (const id of Object.values(profileIds)) {
			if (id) await api.deleteProfile(id, versionId ?? 1).catch(() => {});
		}
		for (const id of [subFolderId, folderId]) {
			if (id) await api.deleteFolder(id).catch(() => {});
		}
		await page.close();
	});

	test('Create a folder and a subfolder', async () => {
		const folder = await profiles.createFolder(folderName);
		folderId = folder.id;
		expect(folder.parentId).toBeNull();
		await expect(profiles.folder(folderName)).toBeVisible();

		const subFolder = await profiles.createFolder(subFolderName, profiles.folder(folderName));
		subFolderId = subFolder.id;
		expect(subFolder.parentId).toBe(folderId);

		await profiles.reload();
		await profiles.expectSubFolder(folderName, subFolderName);
	});

	test('Rename the folder and the subfolder', async () => {
		await profiles.renameFolder(folderName, renamedFolderName);
		await profiles.expand(profiles.folder(renamedFolderName));
		await profiles.renameFolder(subFolderName, renamedSubFolderName);

		await profiles.reload();
		await profiles.expectSubFolder(renamedFolderName, renamedSubFolderName);
		await expect(profiles.folder(folderName)).toBeHidden();
		await expect(profiles.folder(subFolderName)).toBeHidden();
	});

	test('Create a test data profile in the subfolder', async () => {
		await profiles.expectSubFolder(renamedFolderName, renamedSubFolderName);
		await profiles.chooseFromFolderMenu(profiles.folder(renamedSubFolderName), 'New Test Data Profile');

		await expect(page).toHaveURL(new RegExp(`/data/folders/new\\?folderId=${subFolderId}$`));
		await expect(page.getByText('Untitled', { exact: true })).toBeVisible();
		await expect(editor.createButton).toBeEnabled();
		await expect(editor.cancelButton).toBeEnabled();
		await editor.expectColumns(['Parameter 1']);
		await expect(editor.dataSetRows).toHaveCount(1);

		await editor.setInfoPanel(false);
		await editor.addColumnButton.click();
		await expect(editor.column('Parameter 2')).toBeVisible();
		await editor.fillDataSet(editor.dataSetRows.nth(0), dataSets[0]);
		await editor.addRowButton.click();
		await expect(editor.dataSetRows).toHaveCount(2);
		await editor.fillDataSet(editor.dataSetRows.nth(1), dataSets[1]);

		// Rename the columns after entering values; renaming first makes the grid drop typed values.
		for (const [index, parameter] of parameters.entries()) {
			await editor.renameColumn(`Parameter ${index + 1}`, parameter);
		}
		await editor.expectColumns(parameters);
		await editor.expectDataSets(dataSets);

		await editor.setInfoPanel(true);
		await expect(editor.nameField).toBeEmpty();
		await editor.nameField.fill(profileName);
		await expect(editor.nameField).toHaveValue(profileName);

		const createResponse = await editor.saveDataSets(editor.createButton, dataSets, (response) => response.request().method() === 'POST' && /\/private\/test_data$/.test(response.url()));
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
		await expect(editor.title(profileName)).toBeVisible({ timeout: 30000 });
		await expect(profiles.profile(profileName)).toBeVisible();
		await expect(profiles.folder(renamedSubFolderName)).toHaveAccessibleName(`${renamedSubFolderName} (1)`);
		await expect(editor.deleteButton).toBeEnabled();
		await editor.expectColumns(parameters);
		await editor.expectDataSets(dataSets);

		await editor.setInfoPanel(true);
		await expect(editor.nameField).toHaveValue(profileName);

		await profiles.search.fill(profileName);
		await expect(profiles.profile(profileName)).toBeVisible();
		await profiles.search.clear();
	});

	test('Update the profile name, column name, set name and data sets', async () => {
		const profileId = profileIds[profileName];
		const renameResponse = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().includes(`/private/test_data/${profileId}`));
		await editor.nameField.fill(updatedProfileName);
		// The name is saved when the field loses focus.
		await editor.nameField.press('Tab');
		expect((await renameResponse).ok()).toBe(true);
		await expect(page.getByText('Test Data Profile updated successfully')).toBeVisible();
		await expect(profiles.profile(updatedProfileName)).toBeVisible();

		await editor.setInfoPanel(false);
		await editor.renameColumn(parameters[0], renamedParameters[0]);
		await editor.fillDataSet(editor.dataSetRows.nth(0), updatedDataSets[0].slice(0, 2));
		await editor.addRowButton.click();
		await expect(editor.dataSetRows).toHaveCount(3);
		await editor.fillDataSet(editor.dataSetRows.nth(2), updatedDataSets[2]);
		await editor.expectColumns(renamedParameters);
		await editor.expectDataSets(updatedDataSets);

		const saveButton = editor.saveChangesButton;
		await expect(saveButton).toBeEnabled();
		const updateResponse = await editor.saveDataSets(saveButton, updatedDataSets, (response) => response.request().method() === 'PUT' && response.url().includes(`/private/test_data/${profileId}`));
		const updated = await updateResponse.json();
		expect(updated.testDataName).toBe(updatedProfileName);
		expect(updated.columns).toEqual(renamedParameters);
		await expect(saveButton).toBeHidden();

		await page.reload();
		await expect(editor.title(updatedProfileName)).toBeVisible({ timeout: 30000 });
		await expect(profiles.profile(profileName)).toBeHidden();
		await editor.expectColumns(renamedParameters);
		await editor.expectDataSets(updatedDataSets);
	});

	test('Create a test data profile by importing an Excel file into the subfolder', async () => {
		await page.getByRole('button', { name: 'List View' }).click();
		await expect(page.getByText('Create Test Data Profile', { exact: true })).toBeVisible({ timeout: 30000 });
		await page.getByRole('button', { name: 'Import', exact: true }).click();

		const locationDialog = new SelectLocationDialog(page);
		await expect(locationDialog.root.getByText('None', { exact: true })).toBeVisible();
		await expect(locationDialog.confirmButton).toBeDisabled();
		await locationDialog.folder(renamedFolderName).click();
		await locationDialog.folder(renamedSubFolderName).click();
		await expect(locationDialog.root).toContainText(`Target Scenario${renamedFolderName}/${renamedSubFolderName}`);
		await expect(locationDialog.confirmButton).toBeEnabled();
		await locationDialog.confirmButton.click();

		const importDialog = new ImportProfileDialog(page);
		await expect(importDialog.text('Supported file format - MS Excel Sheet')).toBeVisible();
		await expect(importDialog.root.getByRole('link', { name: 'Sample TDP File' })).toBeVisible();
		await expect(importDialog.importButton).toBeDisabled();

		const fieldNamesResponse = page.waitForResponse((response) => response.url().includes('/private/test_data/import_field_names'));
		await importDialog.fileInput.setInputFiles(importFile);
		const { fieldNames } = await (await fieldNamesResponse).json();
		expect(fieldNames).toEqual(['Name', 'Description', 'ExpectedToFail', 'username', 'password']);
		await expect(importDialog.text(path.basename(importFile), { exact: true })).toBeVisible();
		await expect(importDialog.text('Do you want to encrypt any of the columns?')).toBeVisible();
		for (const parameter of importedParameters) {
			await expect(importDialog.text(parameter, { exact: true })).toBeVisible();
		}
		await expect(importDialog.importButton).toBeDisabled();

		await importDialog.nameField.fill(importedProfileName);
		await expect(importDialog.importButton).toBeEnabled();
		const importResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/private/test_data/import?'));
		await importDialog.importButton.click();
		const imported = await importResponse;
		expect(imported.ok()).toBe(true);
		const importParams = new URL(imported.url()).searchParams;
		expect(importParams.get('name')).toBe(importedProfileName);
		expect(importParams.get('testDataFolderId')).toBe(String(subFolderId));
		await expect(importDialog.root).toBeHidden();

		// The tree only shows the imported profile after it is reloaded.
		await profiles.reload();
		await profiles.expectSubFolder(renamedFolderName, renamedSubFolderName);
		await profiles.expand(profiles.folder(renamedSubFolderName));
		await expect(profiles.folder(renamedSubFolderName)).toHaveAccessibleName(`${renamedSubFolderName} (2)`);
		profileIds[importedProfileName] = await profiles.openProfile(importedProfileName);

		await editor.expectColumns(importedParameters);
		await editor.expectDataSets(importedDataSets);
		// ExpectedToFail YES/NO in the sheet maps to the ETF toggle.
		await expect(editor.dataSetRows.nth(0).getByRole('checkbox')).toBeChecked();
		await expect(editor.dataSetRows.nth(1).getByRole('checkbox')).not.toBeChecked();
	});

	test('Delete the test data profiles, the subfolder and the folder', async () => {
		await editor.delete(importedProfileName, profileIds[importedProfileName]!);
		profileIds[importedProfileName] = undefined;

		await profiles.reload();
		await profiles.expectSubFolder(renamedFolderName, renamedSubFolderName);
		await profiles.expand(profiles.folder(renamedSubFolderName));
		await profiles.openProfile(updatedProfileName);
		await editor.delete(updatedProfileName, profileIds[profileName]!);
		profileIds[profileName] = undefined;

		await profiles.reload();
		await profiles.expand(profiles.folder(renamedFolderName));
		await expect(profiles.folder(renamedSubFolderName)).toHaveAccessibleName(renamedSubFolderName);

		await profiles.chooseFromFolderMenu(profiles.folder(renamedFolderName), 'Delete');
		const dialog = profiles.deleteFolderDialog;
		await expect(dialog).toContainText(`Are you sure you want to delete "${renamedFolderName}"? This action cannot be undone.`);
		await expect(dialog).toContainText('This folder contains 1 item(s). Deleting it will also delete all its contents.');
		await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
		const deleteResponse = page.waitForResponse((response) => response.request().method() === 'DELETE' && response.url().includes(`/private/test_data/folders/${folderId}`));
		await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
		expect((await deleteResponse).ok()).toBe(true);
		await expect(page.getByText('Folder deleted successfully')).toBeVisible();

		await profiles.reload();
		await expect(profiles.folder(renamedFolderName)).toBeHidden();
		await expect(profiles.folder(renamedSubFolderName)).toBeHidden();
		for (const id of [folderId, subFolderId]) {
			expect((await api.getFolder(id!)).status()).toBe(404);
		}
		folderId = undefined;
		subFolderId = undefined;
	});
});

test.describe('Verify folder deletion removes nested test data profiles', () => {
	test.skip(missingCredentials, missingCredentialsMessage);

	test('Deleting a folder deletes the test data profiles in its subfolders', async ({ page }) => {
		// Remove this once Testsigma fixes the bug; the test then fails as "expected to fail but passed".
		test.fail(true, 'Testsigma bug: deleting a folder leaves the test data profiles in its subfolders behind.');
		test.setTimeout(120000);
		page.setDefaultTimeout(15000);
		page.setDefaultNavigationTimeout(30000);
		await signInToTestsigma(page);
		const api = new TestDataApi(page);
		const profiles = new TestDataProfilesPage(page);
		await profiles.openFromNavigation();

		const versionId = Number(page.url().match(/\/td\/(\d+)\//)![1]);
		const parentName = `PW_TDP_DeleteFolder_${runId}`;
		const childName = `PW_TDP_DeleteSubFolder_${runId}`;
		const nestedProfileName = `PW_TDP_Nested_${runId}`;
		let parentId: number | undefined;
		let childId: number | undefined;
		let nestedProfileId: number | undefined;

		try {
			// Only the folder deletion is under test, so create its contents through the API.
			const parent = await api.createFolder({ name: parentName, versionId, parentId: null, type: 'FEATURE' });
			expect(parent.ok()).toBe(true);
			parentId = (await parent.json()).id;
			const child = await api.createFolder({ name: childName, versionId, parentId: parentId!, type: 'SCENARIO' });
			expect(child.ok()).toBe(true);
			childId = (await child.json()).id;
			const profile = await api.createProfile({ name: nestedProfileName, versionId, folderId: childId!, setName: 'nested_set', values: { username: 'nested_user' } });
			expect(profile.ok()).toBe(true);
			nestedProfileId = (await profile.json()).id;

			await profiles.reload();
			await profiles.expectSubFolder(parentName, childName);
			await profiles.expand(profiles.folder(childName));
			await expect(profiles.profile(nestedProfileName)).toBeVisible();

			await profiles.chooseFromFolderMenu(profiles.folder(parentName), 'Delete');
			const dialog = profiles.deleteFolderDialog;
			await expect(dialog).toContainText(`Are you sure you want to delete "${parentName}"? This action cannot be undone.`);
			await expect(dialog).toContainText('Deleting it will also delete all its contents.');
			const deleteResponse = page.waitForResponse((response) => response.request().method() === 'DELETE' && response.url().includes(`/private/test_data/folders/${parentId}`));
			await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
			expect((await deleteResponse).ok()).toBe(true);
			await expect(page.getByText('Folder deleted successfully')).toBeVisible();

			await profiles.reload();
			await expect(profiles.folder(parentName)).toBeHidden();
			expect((await api.getFolder(childId!)).status()).toBe(404);
			expect((await api.getProfile(nestedProfileId!)).status(), 'The profile in the subfolder should be deleted with the folder').toBe(404);
		} finally {
			if (nestedProfileId) await api.deleteProfile(nestedProfileId, versionId).catch(() => {});
			for (const id of [childId, parentId]) {
				if (id) await api.deleteFolder(id).catch(() => {});
			}
		}
	});
});
