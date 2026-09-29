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
import { expect, test, type Locator, type Page, type Request } from '@playwright/test';

const email = process.env.TESTSIGMA_EMAIL;
const password = process.env.TESTSIGMA_PASSWORD;

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
type Variable = { id: number; key: string; value: string; projectId: number; isEncrypted: boolean; isDefault?: boolean };

const updatedValues = [
	{ key: variables[1].key, value: 'value_02_updated' },
	{ key: variables[2].key, value: 'value_03_updated' },
];

const encryptedVariable = { key: `pw_env_${runId}_secret`, value: 'secret_value' };
const unencryptedVariable = { key: `pw_env_${runId}_not_secret`, value: 'not_secret_value' };
// A variable added without encryption, then encrypted inside the environment.
const encryptedInEnvironment = variables[3];
// Stored encrypted values come back as ciphertext only.
const ciphertext = /^V2:\S+$/;

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

async function openEnvironments(page: Page) {
	// The side navigation only shows labels while hovered.
	await page.mouse.move(20, 300);
	await page.getByRole('button', { name: 'Test Data', exact: true }).click();
	await page.getByRole('link', { name: 'Environments', exact: true }).click();
	await expect(page).toHaveURL(/\/td\/\d+\/environments$/, { timeout: 30000 });
	await expect(page.getByRole('button', { name: 'Create Environment' })).toBeVisible({ timeout: 30000 });
	return page.url();
}

function environmentRow(page: Page, name: string) {
	return page.getByRole('grid').getByRole('row', { name, exact: true });
}

function variablesTable(page: Page) {
	return page.locator('main table');
}

// Rows have no stable name, so match the one whose name textbox holds the variable.
function variableRow(page: Page, key: string) {
	return variablesTable(page).getByRole('rowgroup').nth(1).getByRole('row').filter({ has: page.locator(`input[value="${key}"]`) });
}

function variableNameField(row: Locator) {
	return row.getByRole('textbox', { name: /^Variable Name at : \d+$/ });
}

function variableValueField(row: Locator) {
	return row.getByRole('textbox', { name: /^Variable Value at : \d+$/ });
}

// The inline editors only register typed input; fill() leaves the page without unsaved changes.
async function typeInto(page: Page, field: Locator, value: string) {
	await field.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.type(value);
	await page.keyboard.press('Tab');
	await expect(field).toHaveValue(value);
}

async function openEnvironment(page: Page, environmentsUrl: string, id: number, name: string) {
	await page.goto(environmentsUrl.replace(/\/environments$/, `/environments/${id}/details`));
	await expect(page.locator('main').getByText(name, { exact: true })).toBeVisible({ timeout: 30000 });
	await expect(variablesTable(page)).toBeVisible({ timeout: 30000 });
}

async function addVariable(page: Page, key: string, value: string) {
	await page.getByRole('button', { name: 'Add Variable', exact: true }).click();
	const dialog = page.getByRole('dialog').filter({ hasText: 'Add Environment Variable' });
	const createButton = dialog.getByRole('button', { name: 'Create', exact: true });
	await expect(dialog.getByRole('heading', { name: 'Add Environment Variable' })).toBeVisible();
	await expect(createButton).toBeDisabled();
	await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();

	await dialog.getByRole('textbox', { name: 'Variable', exact: true }).fill(key);
	await dialog.getByRole('textbox', { name: 'Default Value', exact: true }).fill(value);
	await expect(createButton).toBeEnabled();
	// Variables are saved as a batch for the whole project; the response has no body.
	const createResponse = page.waitForResponse((response) => isVariablesSave(response.request()));
	await createButton.click();
	const response = await createResponse;
	expect(response.ok()).toBe(true);
	expect(response.request().postDataJSON()).toEqual([expect.objectContaining({ key, value, isEncrypted: false })]);
	await expect(dialog).toBeHidden();
	await expect(page.getByText('Variable created successfully').first()).toBeVisible();
	await expect(variableRow(page, key)).toBeVisible();
}

function isVariablesSave(request: Request) {
	return request.method() === 'PUT' && /\/private\/environments\/variables\?projectId=\d+$/.test(request.url());
}

async function listProjectVariables(page: Page, projectId: number): Promise<Variable[]> {
	const response = await page.request.get(`/private/environments/variables?query=projectId:${projectId}&size=500&page=0`);
	expect(response.ok()).toBe(true);
	return (await response.json()).content;
}

// Values set inside an environment override the project default for that environment only.
async function listEnvironmentVariables(page: Page, projectId: number, environmentId: number): Promise<Variable[]> {
	const response = await page.request.get(`/private/environments/variables/${projectId}/${environmentId}?size=500&page=0`);
	expect(response.ok()).toBe(true);
	return (await response.json()).content;
}

function findVariable(list: Variable[], key: string) {
	const variable = list.find((item) => item.key === key);
	expect(variable, `variable ${key}`).toBeDefined();
	return variable!;
}

// The unlocked icon is named "decrypt" and turns encryption on; once on, it shows as "lock".
async function expectEncryptedRow(page: Page, key: string) {
	const row = variableRow(page, key);
	await expect(row).toHaveCount(1);
	await expect(variableValueField(row)).toHaveAttribute('type', 'password');
	await expect(variableValueField(row)).toHaveValue(ciphertext);
	await expect(row.getByTestId('lock')).toBeVisible();
	await expect(row.getByTestId('decrypt')).toHaveCount(0);
}

async function expectVariable(page: Page, key: string, value: string) {
	const row = variableRow(page, key);
	await expect(row).toHaveCount(1);
	await expect(variableNameField(row)).toHaveValue(key);
	await expect(variableValueField(row)).toHaveValue(value);
}

test.describe('Verify the CRUD operations of Environment', () => {
	test.describe.configure({ mode: 'serial', timeout: 240000 });
	test.skip(!email || !password, 'Set TESTSIGMA_EMAIL and TESTSIGMA_PASSWORD in .env to run this test.');

	let page: Page;
	let environmentsUrl: string;
	let environmentId: number | undefined;
	let currentEnvironmentName = environmentName;
	let projectId: number | undefined;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		page.setDefaultTimeout(15000);
		page.setDefaultNavigationTimeout(30000);
		await dismissNewsNotificationWhenShown(page);
		await signIn(page);
		environmentsUrl = await openEnvironments(page);
	});

	test.afterAll(async () => {
		// Remove anything a failed test left behind. Variables belong to the project, so they outlive the environment.
		if (environmentId) await page.request.delete(`/private/environments/${environmentId}`).catch(() => {});
		if (projectId) {
			const leftovers = (await listProjectVariables(page, projectId).catch(() => [] as Variable[])).filter((variable) => variable.key.startsWith(`pw_env_${runId}_`));
			// A save only deletes the first variable marked for deletion, so delete them one at a time.
			for (const { id, key, value, isEncrypted } of leftovers) {
				await page.request.put(`/private/environments/variables?projectId=${projectId}`, {
					data: [{ id, key, value, projectId, isEncrypted, markAsDeleted: true }],
				}).catch(() => {});
			}
		}
		await page.close();
	});

	test('Create an environment', async () => {
		await page.getByRole('button', { name: 'Create Environment' }).click();
		const dialog = page.getByRole('dialog').filter({ hasText: 'Create Environment' });
		await expect(dialog.getByRole('heading', { name: 'Create Environment' })).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();

		await dialog.getByRole('textbox', { name: 'Environment Name' }).fill(environmentName);
		await dialog.getByRole('textbox', { name: 'Write here' }).fill(environmentDescription);
		const createResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/private\/environments$/.test(response.url()));
		await dialog.getByRole('button', { name: 'Create', exact: true }).click();
		const response = await createResponse;
		expect(response.status()).toBe(201);
		const created = await response.json();
		expect(created.name).toBe(environmentName);
		expect(created.description).toBe(environmentDescription);
		environmentId = created.id;
		projectId = response.request().postDataJSON().projectId;

		await expect(dialog).toBeHidden();
		await expect(page.getByText('Environment created successfully').first()).toBeVisible();
		await expect(environmentRow(page, environmentName)).toBeVisible();
		await expect(environmentRow(page, environmentName).getByRole('link', { name: environmentName })).toHaveAttribute('href', new RegExp(`/environments/${environmentId}/details$`));
	});

	test(`Add ${variableCount} variables to the environment`, async () => {
		await environmentRow(page, environmentName).getByRole('link', { name: environmentName }).click();
		await expect(page).toHaveURL(new RegExp(`/environments/${environmentId}/details$`), { timeout: 30000 });
		await expect(page.locator('main').getByText(environmentName, { exact: true })).toBeVisible({ timeout: 30000 });
		await expect(page.getByRole('paragraph').filter({ hasText: environmentDescription })).toBeVisible();

		for (const { key, value } of variables) {
			await addVariable(page, key, value);
		}
		for (const { key, value } of variables) {
			await expectVariable(page, key, value);
		}
	});

	test('Read the environment and its variables after a reload', async () => {
		await openEnvironment(page, environmentsUrl, environmentId!, environmentName);
		await expect(page.getByRole('paragraph').filter({ hasText: environmentDescription })).toBeVisible();
		await expect(page.getByRole('columnheader')).toHaveText(['S.No', /^Variable\s*\*$/, 'Default Value']);
		for (const { key, value } of variables) {
			await expectVariable(page, key, value);
		}
		// Rows are numbered in order.
		const rows = variablesTable(page).getByRole('rowgroup').nth(1).getByRole('row');
		expect(await rows.count()).toBeGreaterThanOrEqual(variableCount);
		for (let index = 0; index < variableCount; index++) {
			await expect(rows.nth(index).getByRole('cell').first()).toHaveText(String(index + 1));
		}
	});

	test('Scroll the variables table to reach every variable', async () => {
		await openEnvironment(page, environmentsUrl, environmentId!, environmentName);
		const table = variablesTable(page);
		const rows = table.getByRole('rowgroup').nth(1).getByRole('row');
		const firstRow = rows.first();
		const lastRow = rows.last();
		// The table scrolls inside its own container; the page itself does not.
		const scrollContainer = table.locator('xpath=ancestor::div[contains(@class, "overflow-scroll")][1]');

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
		await openEnvironment(page, environmentsUrl, environmentId!, environmentName);
		const renamedRow = variableRow(page, renamedVariable.from);
		// Keep the row by its position: the value attribute the row filter relies on changes while typing.
		const renamedLabel = await variableNameField(renamedRow).getAttribute('aria-label');
		await typeInto(page, page.getByRole('textbox', { name: renamedLabel!, exact: true }), renamedVariable.to);
		for (const { key, value } of updatedValues) {
			await typeInto(page, variableValueField(variableRow(page, key)), value);
		}

		await expect(page.getByText('You have unsaved changes', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
		const updateResponse = page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().includes(`/private/environments/${environmentId}`));
		await page.getByRole('button', { name: 'Update', exact: true }).click();
		expect((await updateResponse).ok()).toBe(true);
		await expect(page.getByText('Variable updation successful').first()).toBeVisible();
		await expect(page.getByText('You have unsaved changes', { exact: true })).toBeHidden();

		await openEnvironment(page, environmentsUrl, environmentId!, environmentName);
		await expectVariable(page, renamedVariable.to, variables[0].value);
		await expect(variableRow(page, renamedVariable.from)).toHaveCount(0);
		for (const { key, value } of updatedValues) {
			await expectVariable(page, key, value);
		}
		// Untouched variables keep their values.
		for (const { key, value } of variables.slice(3)) {
			await expectVariable(page, key, value);
		}
	});

	test('Update the environment name and description', async () => {
		// The UI has no control to rename an environment, so update it through the API and verify the UI reflects it.
		const response = await page.request.put(`/private/environments/${environmentId}`, {
			data: { id: environmentId, name: updatedEnvironmentName, description: updatedEnvironmentDescription, projectId },
		});
		expect(response.ok()).toBe(true);
		currentEnvironmentName = updatedEnvironmentName;

		await page.goto(environmentsUrl);
		await expect(environmentRow(page, updatedEnvironmentName)).toBeVisible({ timeout: 30000 });
		await expect(environmentRow(page, environmentName)).toHaveCount(0);
		await openEnvironment(page, environmentsUrl, environmentId!, updatedEnvironmentName);
		await expect(page.getByRole('paragraph').filter({ hasText: updatedEnvironmentDescription })).toBeVisible();
		// Renaming the environment keeps its variables.
		await expectVariable(page, renamedVariable.to, variables[0].value);
		for (const { key, value } of updatedValues) {
			await expectVariable(page, key, value);
		}
	});

	test('Encrypt a variable while adding it', async () => {
		await openEnvironment(page, environmentsUrl, environmentId!, currentEnvironmentName);
		await page.getByRole('button', { name: 'Add Variable', exact: true }).click();
		const dialog = page.getByRole('dialog').filter({ hasText: 'Add Environment Variable' });
		const valueField = dialog.getByRole('textbox', { name: 'Default Value', exact: true });
		await expect(dialog.getByRole('heading', { name: 'Add Environment Variable' })).toBeVisible();
		await dialog.getByRole('textbox', { name: 'Variable', exact: true }).fill(encryptedVariable.key);
		await valueField.fill(encryptedVariable.value);
		await expect(valueField).toHaveAttribute('type', 'text');

		await dialog.getByTestId('decrypt').hover();
		await expect(page.getByText('Encrypting data permanently conceals the original. Backup is strongly advised').first()).toBeVisible();
		await dialog.getByTestId('decrypt').click();
		await expect(dialog.getByTestId('lock')).toBeVisible();
		await expect(valueField).toHaveAttribute('type', 'password');
		await expect(valueField).toHaveValue(encryptedVariable.value);

		// Until it is saved, the value can be shown and hidden again.
		await dialog.getByTestId('visibility-off-outline').click();
		await expect(valueField).toHaveAttribute('type', 'text');
		await dialog.getByTestId('visibility-outline').click();
		await expect(valueField).toHaveAttribute('type', 'password');

		const createRequest = page.waitForRequest(isVariablesSave);
		await dialog.getByRole('button', { name: 'Create', exact: true }).click();
		const request = await createRequest;
		expect(request.postDataJSON()).toEqual([expect.objectContaining({ ...encryptedVariable, isEncrypted: true })]);
		expect((await request.response())!.ok()).toBe(true);
		await expect(dialog).toBeHidden();
		await expect(page.getByText('Variable created successfully').first()).toBeVisible();

		// The server keeps only the ciphertext.
		const saved = findVariable(await listProjectVariables(page, projectId!), encryptedVariable.key);
		expect(saved.isEncrypted).toBe(true);
		expect(saved.value).toMatch(ciphertext);
		expect(saved.value).not.toContain(encryptedVariable.value);

		await openEnvironment(page, environmentsUrl, environmentId!, currentEnvironmentName);
		await expectEncryptedRow(page, encryptedVariable.key);
		await expect(variableValueField(variableRow(page, encryptedVariable.key))).toHaveValue(saved.value);
	});

	test('Turn encryption off before saving a variable', async () => {
		await page.getByRole('button', { name: 'Add Variable', exact: true }).click();
		const dialog = page.getByRole('dialog').filter({ hasText: 'Add Environment Variable' });
		const valueField = dialog.getByRole('textbox', { name: 'Default Value', exact: true });
		await expect(dialog.getByRole('heading', { name: 'Add Environment Variable' })).toBeVisible();
		await dialog.getByRole('textbox', { name: 'Variable', exact: true }).fill(unencryptedVariable.key);
		await valueField.fill(unencryptedVariable.value);

		await dialog.getByTestId('decrypt').click();
		await expect(valueField).toHaveAttribute('type', 'password');
		await dialog.getByTestId('lock').click();
		await expect(dialog.getByTestId('decrypt')).toBeVisible();
		await expect(dialog.getByTestId('lock')).toHaveCount(0);
		await expect(valueField).toHaveAttribute('type', 'text');
		await expect(valueField).toHaveValue(unencryptedVariable.value);

		const createRequest = page.waitForRequest(isVariablesSave);
		await dialog.getByRole('button', { name: 'Create', exact: true }).click();
		const request = await createRequest;
		expect(request.postDataJSON()).toEqual([expect.objectContaining({ ...unencryptedVariable, isEncrypted: false })]);
		expect((await request.response())!.ok()).toBe(true);
		await expect(dialog).toBeHidden();

		const saved = findVariable(await listProjectVariables(page, projectId!), unencryptedVariable.key);
		expect(saved).toMatchObject({ ...unencryptedVariable, isEncrypted: false });
		await openEnvironment(page, environmentsUrl, environmentId!, currentEnvironmentName);
		const row = variableRow(page, unencryptedVariable.key);
		await expectVariable(page, unencryptedVariable.key, unencryptedVariable.value);
		await expect(variableValueField(row)).toHaveAttribute('type', 'text');
		await expect(row.getByTestId('decrypt')).toBeVisible();
	});

	test('Encrypt an existing variable in the environment', async () => {
		await openEnvironment(page, environmentsUrl, environmentId!, currentEnvironmentName);
		const { key, value } = encryptedInEnvironment;
		const row = variableRow(page, key);
		// The "D" badge marks a value inherited from the project default.
		await expect(row.getByText('D', { exact: true })).toBeVisible();
		await expect(variableValueField(row)).toHaveAttribute('type', 'text');

		await row.getByTestId('decrypt').click();
		await expect(row.getByTestId('lock')).toBeVisible();
		await expect(variableValueField(row)).toHaveAttribute('type', 'password');
		await expect(variableValueField(row)).toHaveValue(value);
		await expect(page.getByText('You have unsaved changes', { exact: true })).toBeVisible();

		const updateRequest = page.waitForRequest((request) => request.method() === 'PUT' && request.url().endsWith(`/private/environments/${environmentId}`));
		await page.getByRole('button', { name: 'Update', exact: true }).click();
		const request = await updateRequest;
		expect(request.postDataJSON().variables).toEqual([expect.objectContaining({ key, value, isEncrypted: true })]);
		expect((await request.response())!.ok()).toBe(true);
		await expect(page.getByText('Variable updation successful').first()).toBeVisible();
		await expect(page.getByText('You have unsaved changes', { exact: true })).toBeHidden();

		await openEnvironment(page, environmentsUrl, environmentId!, currentEnvironmentName);
		await expectEncryptedRow(page, key);
		await expect(variableRow(page, key).getByText('D', { exact: true })).toHaveCount(0);
		const inEnvironment = findVariable(await listEnvironmentVariables(page, projectId!, environmentId!), key);
		expect(inEnvironment).toMatchObject({ isEncrypted: true, isDefault: false });
		expect(inEnvironment.value).toMatch(ciphertext);

		// Only this environment's value is encrypted; the project default stays readable.
		expect(findVariable(await listProjectVariables(page, projectId!), key)).toMatchObject({ value, isEncrypted: false });
		await page.goto(environmentsUrl.replace(/\/environments$/, '/environments/variables'));
		await expect(variablesTable(page)).toBeVisible({ timeout: 30000 });
		await expectVariable(page, key, value);
		await expect(variableRow(page, key).getByTestId('decrypt')).toBeVisible();
	});

	test('An encrypted variable cannot be decrypted', async () => {
		await openEnvironment(page, environmentsUrl, environmentId!, currentEnvironmentName);
		for (const key of [encryptedVariable.key, encryptedInEnvironment.key]) {
			const row = variableRow(page, key);
			const storedValue = await variableValueField(row).inputValue();
			// The tooltip opens as the pointer enters the icon, so move away and back until it shows.
			await expect(async () => {
				await page.mouse.move(0, 0);
				await row.getByTestId('lock').hover();
				await expect(page.getByText('Data is encrypted, cannot be decrypted').first()).toBeVisible({ timeout: 1000 });
			}).toPass({ timeout: 15000 });
			await row.getByTestId('lock').click();
			await expectEncryptedRow(page, key);
			await expect(variableValueField(row)).toHaveValue(storedValue);
			await expect(page.getByText('You have unsaved changes', { exact: true })).toBeHidden();
		}

		// Neither the environment nor the project exposes the original value.
		const inEnvironment = await listEnvironmentVariables(page, projectId!, environmentId!);
		for (const [key, value] of [[encryptedVariable.key, encryptedVariable.value], [encryptedInEnvironment.key, encryptedInEnvironment.value]]) {
			const variable = findVariable(inEnvironment, key);
			expect(variable.isEncrypted).toBe(true);
			expect(variable.value).not.toContain(value);
		}
		expect(findVariable(await listProjectVariables(page, projectId!), encryptedVariable.key).value).not.toContain(encryptedVariable.value);
	});

	test('Delete the environment', async () => {
		await openEnvironment(page, environmentsUrl, environmentId!, currentEnvironmentName);
		await page.getByRole('button', { name: 'Delete environment' }).click();

		const dialog = page.getByRole('dialog').filter({ hasText: 'Delete Confirmation' });
		await expect(dialog).toContainText(`Are you sure you want to delete ${currentEnvironmentName}?`);
		await expect(dialog).toContainText('This action cannot be undone.');
		await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
		const deleteResponse = page.waitForResponse((response) => response.request().method() === 'DELETE' && response.url().includes(`/private/environments/${environmentId}`));
		await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
		expect((await deleteResponse).ok()).toBe(true);
		await expect(page.getByText('Environment deleted successfully').first()).toBeVisible();

		await expect(page).toHaveURL(/\/environments$/, { timeout: 30000 });
		await expect(environmentRow(page, currentEnvironmentName)).toHaveCount(0);
		expect((await page.request.get(`/private/environments/${environmentId}`)).status()).toBe(404);
		await page.goto(environmentsUrl.replace(/\/environments$/, `/environments/${environmentId}/details`));
		await expect(page.getByText(`Environment Not Found with id: ${environmentId}`)).toBeVisible({ timeout: 30000 });
		environmentId = undefined;
	});

	test('Delete the variables created by this run', async () => {
		const keys = [renamedVariable.to, ...variables.slice(1).map((variable) => variable.key), encryptedVariable.key, unencryptedVariable.key];
		await page.goto(environmentsUrl.replace(/\/environments$/, '/environments/variables'));
		await expect(variablesTable(page)).toBeVisible({ timeout: 30000 });

		// Marking several rows before saving only deletes the first one, so delete them one at a time.
		for (const key of keys) {
			const row = variableRow(page, key);
			await row.hover();
			await row.getByTestId('more-vertical').click();
			await page.getByText('Mark For Deletion', { exact: true }).click();
			// A row marked for deletion is locked until the change is saved.
			await expect(variableNameField(row)).toBeDisabled();
			await expect(page.getByText('You have unsaved changes', { exact: true })).toBeVisible();
			const deleteRequest = page.waitForRequest(isVariablesSave);
			await page.getByRole('button', { name: 'Update', exact: true }).click();
			expect((await deleteRequest).postDataJSON()).toEqual([expect.objectContaining({ key, markAsDeleted: true })]);
			await expect(page.getByText('You have unsaved changes', { exact: true })).toBeHidden();
			await expect(variableRow(page, key)).toHaveCount(0);
		}

		await page.reload();
		await expect(variablesTable(page)).toBeVisible({ timeout: 30000 });
		for (const key of keys) {
			await expect(variableRow(page, key)).toHaveCount(0);
		}
		expect((await listProjectVariables(page, projectId!)).filter((variable) => variable.key.startsWith(`pw_env_${runId}_`))).toEqual([]);
	});
});
