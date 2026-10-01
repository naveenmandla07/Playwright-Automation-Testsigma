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
import { genAiFeatures } from '../../pages/settings/settingsTabs';
import { GenAiKeysTab } from '../../pages/settings/tabs/GenAiKeysTab';
import { useSettingsTab } from '../../support/admin-settings';

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
	const run = useSettingsTab(GenAiKeysTab);

	test('Open the Gen AI Keys tab and check its elements', async () => {
		await run.tab.open();
		await run.tab.expectElements();
		await expect(run.tab.docsLink).toHaveAttribute('href', 'https://testsigma.com/docs/atto/generative-ai/byok/intro/');
	});

	test('Each feature uses Testsigma\'s own models until the account adds a key', async () => {
		for (const feature of genAiFeatures) {
			const { key, model } = run.tab.featureChoices(feature);
			await expect.soft(key, `key of ${feature}`).toHaveText('Testsigma Default');
			await expect.soft(model, `model of ${feature}`).toHaveText('Select Model');
			// With no keys of its own, the account cannot choose a feature's key or model.
			await expect.soft(key, `key of ${feature}`).toHaveClass(/pointer-events-none/);
			await expect.soft(model, `model of ${feature}`).toHaveClass(/pointer-events-none/);
		}
	});

	test('Open the Create new key form and check its fields', async () => {
		const tab = run.tab;
		await tab.openKeyForm();
		await expect(tab.formText('Create new key')).toBeVisible();
		await expect(tab.keyName).toBeEmpty();
		await expect(tab.keyName).toHaveAttribute('placeholder', 'Enter Key Name');
		// "(Optional)" sits in an element of its own beside the label.
		await expect(tab.formText(/^Description\s*\(Optional\)$/)).toBeVisible();
		await expect(tab.description).toBeEmpty();
		await expect(tab.formText('AI Provider Details')).toBeVisible();
		await expect(tab.providerMenu).toBeVisible();
		await expect(tab.validateKey).toHaveClass(/pointer-events-none/);
		await expect(tab.createButton).toBeDisabled();
		await expect(tab.formButton('Cancel')).toBeEnabled();
		await tab.cancelForm();
	});

	test('The AI providers dropdown lists every provider', async () => {
		const tab = run.tab;
		await tab.openKeyForm();
		await tab.providerMenu.click();
		for (const provider of providers) {
			await expect.soft(tab.providerLogo(provider.name), provider.name).toBeVisible();
			await expect.soft(tab.formText(provider.name), provider.name).toBeVisible();
		}
		await tab.cancelForm();
	});

	for (const provider of providers) {
		test(`Choosing ${provider.name} asks for its own details`, async () => {
			const tab = run.tab;
			await tab.openKeyForm();
			await tab.chooseProvider(provider.name);
			for (const field of provider.fields) {
				await expect.soft(tab.field(field), `field ${field}`).toBeEmpty();
				await expect.soft(tab.field(field), `field ${field}`).toBeEditable();
			}
			for (const text of provider.texts ?? []) {
				await expect.soft(tab.formText(text).first(), `text ${text}`).toBeVisible();
			}
			for (const name of provider.buttons ?? []) {
				await expect.soft(tab.formButton(name), `button ${name}`).toBeVisible();
			}
			await expect(tab.createButton).toBeDisabled();
			await tab.cancelForm();
		});
	}

	test('Azure OpenAI can have more than one model deployment', async () => {
		const tab = run.tab;
		await tab.openKeyForm();
		await tab.chooseProvider('Azure OpenAI');
		await expect(tab.formText('Model 2')).toHaveCount(0);
		await tab.form.getByRole('button', { name: 'Add Model Deployment' }).click();
		await expect(tab.formText('Model 2')).toBeVisible();
		// Each deployment has its own name and version.
		await expect(tab.field('Name')).toHaveCount(2);
		await expect(tab.field('Version')).toHaveCount(2);
		await tab.cancelForm();
	});

	test('A key can be created once it has a name, a provider and an API key', async () => {
		const tab = run.tab;
		await tab.openKeyForm();
		await tab.keyName.fill('Playwright key that is never created');
		await expect(tab.createButton).toBeDisabled();
		await tab.chooseProvider('Gemini AI');
		await expect(tab.createButton).toBeDisabled();
		await tab.field('API Key').fill('not-a-real-api-key');
		await expect(tab.createButton).toBeEnabled();
		// Taking the name away again stops it being created.
		await tab.keyName.clear();
		await expect(tab.createButton).toBeDisabled();
		await tab.cancelForm();
	});
});
