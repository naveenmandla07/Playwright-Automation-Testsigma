/**
 * The Gen AI Keys tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Gen AI Keys tab and check its elements, including the link to its documentation.
 * - Check each AI feature is mapped to Testsigma's own models, and that its key and model cannot be chosen while
 *   the account has no keys of its own.
 * - Open "Create new key" and check the form, then each AI provider's own fields, adding a second Azure OpenAI
 *   model deployment, and that a key can be created once it has a name, a provider and an API key.
 *
 * Nothing is saved: "Create" and "Validate API key" are checked but never clicked, and every form is cancelled.
 */
import { expect, test } from '@playwright/test';
import { expectTabElements, genAiFeatures, openTab, useSettingsTab } from '../../support/admin-settings';

type Provider = { name: string; fields: string[]; texts?: (string | RegExp)[]; buttons?: string[] };

const providers: Provider[] = [
	{
		name: 'Azure OpenAI',
		fields: ['API Key', 'Azure Resource Name', 'Name', 'Version'],
		texts: ['Model Deployments', 'Model 1'],
		buttons: ['Add Model Deployment'],
	},
	{ name: 'Open AI', fields: ['API Key'] },
	{ name: 'Gemini AI', fields: ['API Key'] },
	{
		name: 'Vertex AI',
		fields: ['Vertex Region'],
		texts: [/^Service Account File/, 'Browse file', 'Upload the service account JSON file to authenticate with Vertex AI.'],
	},
];

test.describe('Verify the Gen AI Keys', () => {
	const run = useSettingsTab('Gen AI Keys');

	function keyForm() {
		return run.page.getByRole('dialog');
	}

	async function openKeyForm() {
		await run.main.getByText('Create new key', { exact: true }).click();
		await expect(keyForm().getByRole('textbox', { name: 'Key Name' })).toBeVisible();
	}

	async function chooseProvider(name: string) {
		await keyForm().getByText('Select provider', { exact: true }).click();
		await keyForm().getByText(name, { exact: true }).click();
		await expect(keyForm().getByRole('img', { name: `${name} logo` })).toBeVisible();
		await expect(keyForm().getByText('Select provider', { exact: true })).toHaveCount(0);
	}

	async function cancelForm() {
		await keyForm().getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(keyForm()).toHaveCount(0);
	}

	// "Validate API key" is text rather than a button, greyed out and ignoring clicks while it cannot be used.
	function validateKey() {
		return keyForm().getByText('Validate API key', { exact: true });
	}

	test('Open the Gen AI Keys tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
		await expect(run.main.getByRole('link').filter({ has: run.page.locator('svg') }).first()).toHaveAttribute('href', 'https://testsigma.com/docs/atto/generative-ai/byok/intro/');
	});

	test('Each feature uses Testsigma\'s own models until the account adds a key', async () => {
		for (const feature of genAiFeatures) {
			const row = run.main.getByText(feature, { exact: true }).locator('xpath=..');
			const [key, model] = [row.locator('[data-isopen]').nth(0), row.locator('[data-isopen]').nth(1)];
			await expect.soft(key, `key of ${feature}`).toHaveText('Testsigma Default');
			await expect.soft(model, `model of ${feature}`).toHaveText('Select Model');
			// With no keys of its own, the account cannot choose a feature's key or model.
			await expect.soft(key, `key of ${feature}`).toHaveClass(/pointer-events-none/);
			await expect.soft(model, `model of ${feature}`).toHaveClass(/pointer-events-none/);
		}
	});

	test('Open the Create new key form and check its fields', async () => {
		await openKeyForm();
		const form = keyForm();
		await expect(form.getByText('Create new key', { exact: true })).toBeVisible();
		await expect(form.getByRole('textbox', { name: 'Key Name' })).toBeEmpty();
		await expect(form.getByRole('textbox', { name: 'Key Name' })).toHaveAttribute('placeholder', 'Enter Key Name');
		// "(Optional)" sits in an element of its own beside the label.
		await expect(form.getByText(/^Description\s*\(Optional\)$/)).toBeVisible();
		await expect(form.getByRole('textbox', { name: 'Description' })).toBeEmpty();
		await expect(form.getByText('AI Provider Details', { exact: true })).toBeVisible();
		await expect(form.getByText('Select provider', { exact: true })).toBeVisible();
		await expect(validateKey()).toHaveClass(/pointer-events-none/);
		await expect(form.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
		await expect(form.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
		await cancelForm();
	});

	test('The AI providers dropdown lists every provider', async () => {
		await openKeyForm();
		await keyForm().getByText('Select provider', { exact: true }).click();
		for (const provider of providers) {
			await expect.soft(keyForm().getByRole('img', { name: `${provider.name} logo` }), provider.name).toBeVisible();
			await expect.soft(keyForm().getByText(provider.name, { exact: true }), provider.name).toBeVisible();
		}
		await cancelForm();
	});

	for (const provider of providers) {
		test(`Choosing ${provider.name} asks for its own details`, async () => {
			await openKeyForm();
			await chooseProvider(provider.name);
			const form = keyForm();
			for (const field of provider.fields) {
				await expect.soft(form.getByRole('textbox', { name: field, exact: true }), `field ${field}`).toBeEmpty();
				await expect.soft(form.getByRole('textbox', { name: field, exact: true }), `field ${field}`).toBeEditable();
			}
			for (const text of provider.texts ?? []) {
				const shown = typeof text === 'string' ? form.getByText(text, { exact: true }) : form.getByText(text);
				await expect.soft(shown.first(), `text ${text}`).toBeVisible();
			}
			for (const name of provider.buttons ?? []) {
				await expect.soft(form.getByRole('button', { name, exact: true }), `button ${name}`).toBeVisible();
			}
			await expect(form.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
			await cancelForm();
		});
	}

	test('Azure OpenAI can have more than one model deployment', async () => {
		await openKeyForm();
		await chooseProvider('Azure OpenAI');
		const form = keyForm();
		await expect(form.getByText('Model 2', { exact: true })).toHaveCount(0);
		await form.getByRole('button', { name: 'Add Model Deployment' }).click();
		await expect(form.getByText('Model 2', { exact: true })).toBeVisible();
		// Each deployment has its own name and version.
		await expect(form.getByRole('textbox', { name: 'Name', exact: true })).toHaveCount(2);
		await expect(form.getByRole('textbox', { name: 'Version', exact: true })).toHaveCount(2);
		await cancelForm();
	});

	test('A key can be created once it has a name, a provider and an API key', async () => {
		await openKeyForm();
		const form = keyForm();
		const create = form.getByRole('button', { name: 'Create', exact: true });
		await form.getByRole('textbox', { name: 'Key Name' }).fill('Playwright key that is never created');
		await expect(create).toBeDisabled();
		await chooseProvider('Gemini AI');
		await expect(create).toBeDisabled();
		await form.getByRole('textbox', { name: 'API Key', exact: true }).fill('not-a-real-api-key');
		await expect(create).toBeEnabled();
		// Taking the name away again stops it being created.
		await form.getByRole('textbox', { name: 'Key Name' }).clear();
		await expect(create).toBeDisabled();
		await cancelForm();
	});
});
