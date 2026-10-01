/**
 * Creating, reading, updating and deleting an environment and its variables, including encrypted variables.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Create an environment and add 20 variables.
 * - Read the environment and its variables after a reload, and scroll the variables table end to end.
 * - Rename a variable and change two values.
 * - Rename the environment and change its description (through the API, as the UI has no rename control).
 * - Encryption:
 *   - Encrypt a variable while adding it; the server stores only ciphertext.
 *   - Turn encryption off again before saving.
 *   - Encrypt an existing variable inside the environment; only this environment's value is encrypted and the
 *     project default stays readable.
 *   - Check an encrypted variable cannot be decrypted, since Testsigma offers no way to do so.
 * - Delete the environment, then the variables created by this run.
 *
 * Variables belong to the whole project rather than one environment, so their names carry the run id, and
 * anything a failed run leaves behind is removed afterwards.
 */
import { expect, test, type Page } from '@playwright/test';
import { EnvironmentsApi, findVariable, isVariablesSave, type Variable } from '../pages/test-data/EnvironmentsApi';
import { ciphertext, EnvironmentPage, EnvironmentsPage } from '../pages/test-data/EnvironmentsPage';
import { missingCredentials, missingCredentialsMessage, signInToTestsigma } from '../support/testsigma-auth';

const runId = Date.now();
const environmentName = `PW_ENV_${runId}`;
const environmentDescription = 'Environment created by the Testsigma Playwright automation suite.';
const updatedEnvironmentName = `${environmentName}_Updated`;
const updatedEnvironmentDescription = 'Environment updated by the Testsigma Playwright automation suite.';

// Variables are shared by every environment in the project, so their names carry the run id to stay unique.
const variableCount = 20;
const variables = Array.from({ length: variableCount }, (_, index) => {
	const number = String(index + 1).padStart(2, '0');
	return { key: `pw_env_${runId}_var_${number}`, value: `value_${number}` };
});
const renamedVariable = { from: variables[0].key, to: `${variables[0].key}_renamed` };

const updatedValues = [
	{ key: variables[1].key, value: 'value_02_updated' },
	{ key: variables[2].key, value: 'value_03_updated' },
];

const encryptedVariable = { key: `pw_env_${runId}_secret`, value: 'secret_value' };
const unencryptedVariable = { key: `pw_env_${runId}_not_secret`, value: 'not_secret_value' };
// A variable added without encryption, then encrypted inside the environment.
const encryptedInEnvironment = variables[3];

test.describe('Verify the CRUD operations of Environment', () => {
	test.describe.configure({ mode: 'serial', timeout: 240000 });
	test.skip(missingCredentials, missingCredentialsMessage);

	let page: Page;
	let api: EnvironmentsApi;
	let environments: EnvironmentsPage;
	let environment: EnvironmentPage;
	let environmentId: number | undefined;
	let currentEnvironmentName = environmentName;
	let projectId: number | undefined;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		page.setDefaultTimeout(15000);
		page.setDefaultNavigationTimeout(30000);
		await signInToTestsigma(page);
		api = new EnvironmentsApi(page);
		environments = new EnvironmentsPage(page);
		environment = new EnvironmentPage(page, await environments.openFromNavigation());
	});

	test.afterAll(async () => {
		// Remove anything a failed test left behind. Variables belong to the project, so they outlive the environment.
		if (environmentId) await api.delete(environmentId).catch(() => {});
		if (projectId) {
			const leftovers = (await api.projectVariables(projectId).catch(() => [] as Variable[])).filter((variable) => variable.key.startsWith(`pw_env_${runId}_`));
			// A save only deletes the first variable marked for deletion, so delete them one at a time.
			for (const variable of leftovers) {
				await api.deleteVariable(projectId, variable).catch(() => {});
			}
		}
		await page.close();
	});

	test('Create an environment', async () => {
		await environments.createButton.click();
		const dialog = environments.createDialog;
		await expect(dialog.heading).toBeVisible();
		await expect(dialog.cancelButton).toBeEnabled();

		await dialog.nameField.fill(environmentName);
		await dialog.descriptionField.fill(environmentDescription);
		const createResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/private\/environments$/.test(response.url()));
		await dialog.createButton.click();
		const response = await createResponse;
		expect(response.status()).toBe(201);
		const created = await response.json();
		expect(created.name).toBe(environmentName);
		expect(created.description).toBe(environmentDescription);
		environmentId = created.id;
		projectId = response.request().postDataJSON().projectId;

		await expect(dialog.root).toBeHidden();
		await expect(page.getByText('Environment created successfully').first()).toBeVisible();
		await expect(environments.row(environmentName)).toBeVisible();
		await expect(environments.link(environmentName)).toHaveAttribute('href', new RegExp(`/environments/${environmentId}/details$`));
	});

	test(`Add ${variableCount} variables to the environment`, async () => {
		await environments.link(environmentName).click();
		await expect(page).toHaveURL(new RegExp(`/environments/${environmentId}/details$`), { timeout: 30000 });
		await expect(environment.title(environmentName)).toBeVisible({ timeout: 30000 });
		await expect(environment.description(environmentDescription)).toBeVisible();

		for (const { key, value } of variables) {
			await environment.addVariable(key, value);
		}
		for (const { key, value } of variables) {
			await environment.expectVariable(key, value);
		}
	});

	test('Read the environment and its variables after a reload', async () => {
		await environment.open(environmentId!, environmentName);
		await expect(environment.description(environmentDescription)).toBeVisible();
		await expect(page.getByRole('columnheader')).toHaveText(['S.No', /^Variable\s*\*$/, 'Default Value']);
		for (const { key, value } of variables) {
			await environment.expectVariable(key, value);
		}
		// Rows are numbered in order.
		const rows = environment.rows;
		expect(await rows.count()).toBeGreaterThanOrEqual(variableCount);
		for (let index = 0; index < variableCount; index++) {
			await expect(rows.nth(index).getByRole('cell').first()).toHaveText(String(index + 1));
		}
	});

	test('Scroll the variables table to reach every variable', async () => {
		await environment.open(environmentId!, environmentName);
		const firstRow = environment.rows.first();
		const lastRow = environment.rows.last();
		// The table scrolls inside its own container; the page itself does not.
		const scrollContainer = environment.table.locator('xpath=ancestor::div[contains(@class, "overflow-scroll")][1]');

		await expect(firstRow).toBeInViewport();
		await expect(lastRow).not.toBeInViewport();
		expect(await scrollContainer.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
		expect(await scrollContainer.evaluate((element) => element.scrollTop)).toBe(0);

		await firstRow.hover();
		await expect(async () => {
			await page.mouse.wheel(0, 600);
			await expect(lastRow).toBeInViewport({ timeout: 1000 });
		}).toPass({ timeout: 20000 });
		expect(await scrollContainer.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
		await expect(firstRow).not.toBeInViewport();
		// The header row stays pinned while the rows scroll.
		await expect(page.getByRole('columnheader', { name: 'Variable *' })).toBeInViewport();

		await expect(async () => {
			await page.mouse.wheel(0, -600);
			await expect(firstRow).toBeInViewport({ timeout: 1000 });
		}).toPass({ timeout: 20000 });
		expect(await scrollContainer.evaluate((element) => element.scrollTop)).toBe(0);
	});

	test('Update a variable name and values', async () => {
		await environment.open(environmentId!, environmentName);
		const renamedRow = environment.variableRow(renamedVariable.from);
		// Keep the row by its position: the value attribute the row filter relies on changes while typing.
		const renamedLabel = await environment.nameField(renamedRow).getAttribute('aria-label');
		await environment.typeInto(page.getByRole('textbox', { name: renamedLabel!, exact: true }), renamedVariable.to);
		for (const { key, value } of updatedValues) {
			await environment.typeInto(environment.valueField(environment.variableRow(key)), value);
		}

		await expect(environment.unsavedChanges).toBeVisible();
		await expect(environment.cancelButton).toBeEnabled();
		const updateResponse = page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().includes(`/private/environments/${environmentId}`));
		await environment.updateButton.click();
		expect((await updateResponse).ok()).toBe(true);
		await expect(page.getByText('Variable updation successful').first()).toBeVisible();
		await expect(environment.unsavedChanges).toBeHidden();

		await environment.open(environmentId!, environmentName);
		await environment.expectVariable(renamedVariable.to, variables[0].value);
		await expect(environment.variableRow(renamedVariable.from)).toHaveCount(0);
		for (const { key, value } of updatedValues) {
			await environment.expectVariable(key, value);
		}
		// Untouched variables keep their values.
		for (const { key, value } of variables.slice(3)) {
			await environment.expectVariable(key, value);
		}
	});

	test('Update the environment name and description', async () => {
		// The UI has no control to rename an environment, so update it through the API and verify the UI reflects it.
		const response = await api.update(environmentId!, { name: updatedEnvironmentName, description: updatedEnvironmentDescription, projectId });
		expect(response.ok()).toBe(true);
		currentEnvironmentName = updatedEnvironmentName;

		await page.goto(environment.environmentsUrl);
		await expect(environments.row(updatedEnvironmentName)).toBeVisible({ timeout: 30000 });
		await expect(environments.row(environmentName)).toHaveCount(0);
		await environment.open(environmentId!, updatedEnvironmentName);
		await expect(environment.description(updatedEnvironmentDescription)).toBeVisible();
		// Renaming the environment keeps its variables.
		await environment.expectVariable(renamedVariable.to, variables[0].value);
		for (const { key, value } of updatedValues) {
			await environment.expectVariable(key, value);
		}
	});

	test('Encrypt a variable while adding it', async () => {
		await environment.open(environmentId!, currentEnvironmentName);
		await environment.addVariableButton.click();
		const dialog = environment.addVariableDialog;
		await expect(dialog.heading).toBeVisible();
		await dialog.keyField.fill(encryptedVariable.key);
		await dialog.valueField.fill(encryptedVariable.value);
		await expect(dialog.valueField).toHaveAttribute('type', 'text');

		await dialog.encryptIcon.hover();
		await expect(page.getByText('Encrypting data permanently conceals the original. Backup is strongly advised').first()).toBeVisible();
		await dialog.encryptIcon.click();
		await expect(dialog.lockIcon).toBeVisible();
		await expect(dialog.valueField).toHaveAttribute('type', 'password');
		await expect(dialog.valueField).toHaveValue(encryptedVariable.value);

		// Until it is saved, the value can be shown and hidden again.
		await dialog.showValueIcon.click();
		await expect(dialog.valueField).toHaveAttribute('type', 'text');
		await dialog.hideValueIcon.click();
		await expect(dialog.valueField).toHaveAttribute('type', 'password');

		const createRequest = page.waitForRequest(isVariablesSave);
		await dialog.createButton.click();
		const request = await createRequest;
		expect(request.postDataJSON()).toEqual([expect.objectContaining({ ...encryptedVariable, isEncrypted: true })]);
		expect((await request.response())!.ok()).toBe(true);
		await expect(dialog.root).toBeHidden();
		await expect(page.getByText('Variable created successfully').first()).toBeVisible();

		// The server keeps only the ciphertext.
		const saved = findVariable(await api.projectVariables(projectId!), encryptedVariable.key);
		expect(saved.isEncrypted).toBe(true);
		expect(saved.value).toMatch(ciphertext);
		expect(saved.value).not.toContain(encryptedVariable.value);

		await environment.open(environmentId!, currentEnvironmentName);
		await environment.expectEncryptedRow(encryptedVariable.key);
		await expect(environment.valueField(environment.variableRow(encryptedVariable.key))).toHaveValue(saved.value);
	});

	test('Turn encryption off before saving a variable', async () => {
		await environment.addVariableButton.click();
		const dialog = environment.addVariableDialog;
		await expect(dialog.heading).toBeVisible();
		await dialog.keyField.fill(unencryptedVariable.key);
		await dialog.valueField.fill(unencryptedVariable.value);

		await dialog.encryptIcon.click();
		await expect(dialog.valueField).toHaveAttribute('type', 'password');
		await dialog.lockIcon.click();
		await expect(dialog.encryptIcon).toBeVisible();
		await expect(dialog.lockIcon).toHaveCount(0);
		await expect(dialog.valueField).toHaveAttribute('type', 'text');
		await expect(dialog.valueField).toHaveValue(unencryptedVariable.value);

		const createRequest = page.waitForRequest(isVariablesSave);
		await dialog.createButton.click();
		const request = await createRequest;
		expect(request.postDataJSON()).toEqual([expect.objectContaining({ ...unencryptedVariable, isEncrypted: false })]);
		expect((await request.response())!.ok()).toBe(true);
		await expect(dialog.root).toBeHidden();

		const saved = findVariable(await api.projectVariables(projectId!), unencryptedVariable.key);
		expect(saved).toMatchObject({ ...unencryptedVariable, isEncrypted: false });
		await environment.open(environmentId!, currentEnvironmentName);
		const row = environment.variableRow(unencryptedVariable.key);
		await environment.expectVariable(unencryptedVariable.key, unencryptedVariable.value);
		await expect(environment.valueField(row)).toHaveAttribute('type', 'text');
		await expect(row.getByTestId('decrypt')).toBeVisible();
	});

	test('Encrypt an existing variable in the environment', async () => {
		await environment.open(environmentId!, currentEnvironmentName);
		const { key, value } = encryptedInEnvironment;
		const row = environment.variableRow(key);
		// The "D" badge marks a value inherited from the project default.
		await expect(row.getByText('D', { exact: true })).toBeVisible();
		await expect(environment.valueField(row)).toHaveAttribute('type', 'text');

		await row.getByTestId('decrypt').click();
		await expect(row.getByTestId('lock')).toBeVisible();
		await expect(environment.valueField(row)).toHaveAttribute('type', 'password');
		await expect(environment.valueField(row)).toHaveValue(value);
		await expect(environment.unsavedChanges).toBeVisible();

		const updateRequest = page.waitForRequest((request) => request.method() === 'PUT' && request.url().endsWith(`/private/environments/${environmentId}`));
		await environment.updateButton.click();
		const request = await updateRequest;
		expect(request.postDataJSON().variables).toEqual([expect.objectContaining({ key, value, isEncrypted: true })]);
		expect((await request.response())!.ok()).toBe(true);
		await expect(page.getByText('Variable updation successful').first()).toBeVisible();
		await expect(environment.unsavedChanges).toBeHidden();

		await environment.open(environmentId!, currentEnvironmentName);
		await environment.expectEncryptedRow(key);
		await expect(environment.variableRow(key).getByText('D', { exact: true })).toHaveCount(0);
		const inEnvironment = findVariable(await api.environmentVariables(projectId!, environmentId!), key);
		expect(inEnvironment).toMatchObject({ isEncrypted: true, isDefault: false });
		expect(inEnvironment.value).toMatch(ciphertext);

		// Only this environment's value is encrypted; the project default stays readable.
		expect(findVariable(await api.projectVariables(projectId!), key)).toMatchObject({ value, isEncrypted: false });
		await environment.openProjectVariables();
		await environment.expectVariable(key, value);
		await expect(environment.variableRow(key).getByTestId('decrypt')).toBeVisible();
	});

	test('An encrypted variable cannot be decrypted', async () => {
		await environment.open(environmentId!, currentEnvironmentName);
		for (const key of [encryptedVariable.key, encryptedInEnvironment.key]) {
			const row = environment.variableRow(key);
			const storedValue = await environment.valueField(row).inputValue();
			// The tooltip opens as the pointer enters the icon, so move away and back until it shows.
			await expect(async () => {
				await page.mouse.move(0, 0);
				await row.getByTestId('lock').hover();
				await expect(page.getByText('Data is encrypted, cannot be decrypted').first()).toBeVisible({ timeout: 1000 });
			}).toPass({ timeout: 15000 });
			await row.getByTestId('lock').click();
			await environment.expectEncryptedRow(key);
			await expect(environment.valueField(row)).toHaveValue(storedValue);
			await expect(environment.unsavedChanges).toBeHidden();
		}

		// Neither the environment nor the project exposes the original value.
		const inEnvironment = await api.environmentVariables(projectId!, environmentId!);
		for (const [key, value] of [[encryptedVariable.key, encryptedVariable.value], [encryptedInEnvironment.key, encryptedInEnvironment.value]]) {
			const variable = findVariable(inEnvironment, key);
			expect(variable.isEncrypted).toBe(true);
			expect(variable.value).not.toContain(value);
		}
		expect(findVariable(await api.projectVariables(projectId!), encryptedVariable.key).value).not.toContain(encryptedVariable.value);
	});

	test('Delete the environment', async () => {
		await environment.open(environmentId!, currentEnvironmentName);
		await environment.deleteButton.click();

		const dialog = environment.deleteDialog;
		await expect(dialog).toContainText(`Are you sure you want to delete ${currentEnvironmentName}?`);
		await expect(dialog).toContainText('This action cannot be undone.');
		await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
		const deleteResponse = page.waitForResponse((response) => response.request().method() === 'DELETE' && response.url().includes(`/private/environments/${environmentId}`));
		await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
		expect((await deleteResponse).ok()).toBe(true);
		await expect(page.getByText('Environment deleted successfully').first()).toBeVisible();

		await expect(page).toHaveURL(/\/environments$/, { timeout: 30000 });
		await expect(environments.row(currentEnvironmentName)).toHaveCount(0);
		expect((await api.get(environmentId!)).status()).toBe(404);
		await page.goto(environment.detailsUrl(environmentId!));
		await expect(page.getByText(`Environment Not Found with id: ${environmentId}`)).toBeVisible({ timeout: 30000 });
		environmentId = undefined;
	});

	test('Delete the variables created by this run', async () => {
		const keys = [renamedVariable.to, ...variables.slice(1).map((variable) => variable.key), encryptedVariable.key, unencryptedVariable.key];
		await environment.openProjectVariables();

		// Marking several rows before saving only deletes the first one, so delete them one at a time.
		for (const key of keys) {
			const row = environment.variableRow(key);
			await row.hover();
			await row.getByTestId('more-vertical').click();
			await page.getByText('Mark For Deletion', { exact: true }).click();
			// A row marked for deletion is locked until the change is saved.
			await expect(environment.nameField(row)).toBeDisabled();
			await expect(environment.unsavedChanges).toBeVisible();
			const deleteRequest = page.waitForRequest(isVariablesSave);
			await environment.updateButton.click();
			expect((await deleteRequest).postDataJSON()).toEqual([expect.objectContaining({ key, markAsDeleted: true })]);
			await expect(environment.unsavedChanges).toBeHidden();
			await expect(environment.variableRow(key)).toHaveCount(0);
		}

		await page.reload();
		await expect(environment.table).toBeVisible({ timeout: 30000 });
		for (const key of keys) {
			await expect(environment.variableRow(key)).toHaveCount(0);
		}
		expect((await api.projectVariables(projectId!)).filter((variable) => variable.key.startsWith(`pw_env_${runId}_`))).toEqual([]);
	});
});
