/**
 * The API Keys tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the API Keys tab and check its elements.
 * - Check every key in the list: its switch, name, expiration and parallel allocation, and the "Copy API Key" and
 *   "Edit" buttons shown on hovering it.
 * - Open "Generate new API Key" and check the form: the key name it needs, blocking parallels, allocating more
 *   parallels than the account has, each expiration choice, including a custom date, and closing it.
 * - Open "Edit" on a key and check its details are shown, with the key itself masked, then close it.
 *
 * Nothing is saved: "Generate API Key" and "Update" are checked but never clicked, and a key's switch is never
 * used, since turning a key off would stop anything using it. The keys belong to the account, so they are
 * checked for what every key shows rather than for particular names.
 */
import { expect, test, type Locator } from '@playwright/test';
import { expectTabElements, openTab, reopenTab, useSettingsTab } from '../support/admin-settings';

const expirationChoices = ['7 days', '30 days', '90 days', 'Custom', 'Never expires'];

// Each key is a row inside the grid's own wrapping row.
function keyRows(main: Locator) {
	return main.getByRole('grid').getByRole('row').getByRole('row');
}

test.describe('Verify the API Keys', () => {
	const run = useSettingsTab('API Keys');

	function keyForm() {
		return run.page.getByRole('dialog');
	}

	async function openGenerateForm() {
		await run.main.getByRole('button', { name: 'Generate new API Key' }).click();
		await expect(keyForm().getByRole('textbox', { name: 'Key name' })).toBeVisible();
	}

	async function closeForm() {
		await keyForm().getByRole('button', { name: 'Close', exact: true }).click();
		await expect(keyForm()).toHaveCount(0);
	}

	test('Open the API Keys tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
	});

	test('Check every key in the list', async () => {
		const rows = keyRows(run.main);
		await expect(rows.first()).toBeVisible();
		const count = await rows.count();
		test.info().annotations.push({ type: 'keys', description: `${count} keys` });
		for (let index = 0; index < count; index += 1) {
			const row = rows.nth(index);
			const cells = row.getByRole('gridcell');
			// Each key has a switch for turning it on or off, named after the key.
			const name = (await cells.nth(1).innerText()).trim();
			expect.soft(name, `name of key ${index + 1}`).not.toBe('');
			await expect.soft(row.getByRole('checkbox', { name: `common.enable ${name}`, exact: true })).toBeAttached();
			await expect.soft(cells.nth(2), `expiration of ${name}`).toHaveText(/^(Never expires|.*\d.*)$/);
			await expect.soft(cells.nth(3), `parallel allocation of ${name}`).toHaveText(/^(Max available|\d+.*)$/);
			// The key's own buttons only show while it is hovered.
			await row.hover();
			await expect.soft(row.getByRole('button', { name: 'Copy API Key' }), `Copy API Key of ${name}`).toBeVisible();
			await expect.soft(row.getByRole('button', { name: 'Edit', exact: true }), `Edit of ${name}`).toBeVisible();
		}
	});

	test('Open the Generate API Key form and check its fields', async () => {
		await openGenerateForm();
		const form = keyForm();
		// "Generate API Key" is both the form's title and its button.
		await expect(form.getByText('Generate API Key', { exact: true })).toHaveCount(2);
		await expect(form.getByRole('textbox', { name: 'Key name' })).toBeEmpty();
		await expect(form.getByRole('checkbox', { name: 'Block Parallels' })).not.toBeChecked();
		await expect(form.getByRole('spinbutton', { name: 'Allocate parallels' })).toBeEmpty();
		await expect(form.getByText(/^Account has \d+ parallels? left$/)).toBeVisible();
		await expect(form.getByText('Expiration', { exact: true })).toBeVisible();
		for (const choice of expirationChoices) {
			await expect.soft(form.getByRole('button', { name: choice, exact: true }), `expiration ${choice}`).toBeVisible();
		}
		// A key needs a name before it can be generated.
		await expect(form.getByRole('button', { name: 'Generate API Key' })).toBeDisabled();
		await expect(form.getByRole('button', { name: 'Close', exact: true })).toBeEnabled();
		await closeForm();
	});

	test('A key can be generated once it has a name', async () => {
		await openGenerateForm();
		const form = keyForm();
		const generate = form.getByRole('button', { name: 'Generate API Key' });
		await form.getByRole('textbox', { name: 'Key name' }).fill('Playwright key that is never generated');
		await expect(generate).toBeEnabled();
		await form.getByRole('textbox', { name: 'Key name' }).clear();
		await expect(generate).toBeDisabled();
		await closeForm();
	});

	test('Parallels beyond what the account has cannot be allocated', async () => {
		await openGenerateForm();
		const form = keyForm();
		const available = Number((await form.getByText(/^Account has \d+ parallels? left$/).innerText()).match(/\d+/)![0]);
		const tooMany = available + 7;
		await form.getByRole('textbox', { name: 'Key name' }).fill('Playwright key that is never generated');
		await form.getByRole('spinbutton', { name: 'Allocate parallels' }).fill(String(tooMany));
		await expect(form.getByText(`Cannot allocate ${tooMany} parallels, only ${available} are available for allocation`, { exact: true })).toBeVisible();
		await expect(form.getByRole('button', { name: 'Generate API Key' })).toBeDisabled();
		// Allocating what the account has is accepted again.
		await form.getByRole('spinbutton', { name: 'Allocate parallels' }).fill(String(available));
		await expect(form.getByText(/^Cannot allocate/)).toHaveCount(0);
		await expect(form.getByRole('button', { name: 'Generate API Key' })).toBeEnabled();
		await closeForm();
	});

	test('Block Parallels can be turned on and off', async () => {
		await openGenerateForm();
		const block = keyForm().getByRole('checkbox', { name: 'Block Parallels' });
		await keyForm().getByText('Block Parallels', { exact: true }).click();
		await expect(block).toBeChecked();
		await keyForm().getByText('Block Parallels', { exact: true }).click();
		await expect(block).not.toBeChecked();
		await closeForm();
	});

	test('Each expiration can be chosen, and Custom asks for a date', async () => {
		await openGenerateForm();
		const form = keyForm();
		const customDate = form.getByRole('textbox', { name: 'Select expiration date and time' });
		await expect(customDate).toHaveCount(0);
		for (const choice of expirationChoices) {
			await form.getByRole('button', { name: choice, exact: true }).click();
			if (choice === 'Custom') {
				await expect(customDate).toBeVisible();
			} else {
				await expect(customDate).toHaveCount(0);
			}
		}
		await closeForm();
	});

	test('Edit shows a key\'s details with the key masked', async () => {
		// Start from a freshly loaded list, as the earlier checks hovered over it.
		await reopenTab(run.page, run.tab);
		const row = keyRows(run.main).first();
		const name = (await row.getByRole('gridcell').nth(1).innerText()).trim();
		await row.hover();
		await row.getByRole('button', { name: 'Edit', exact: true }).click();
		const form = keyForm();
		// The edit form keeps the title of the form that generates keys.
		await expect(form.getByText('Generate API Key', { exact: true }).first()).toBeVisible();
		await expect(form.getByRole('textbox', { name: 'Key name' })).toHaveValue(name);
		for (const choice of expirationChoices) {
			await expect.soft(form.getByRole('button', { name: choice, exact: true }), `expiration ${choice}`).toBeVisible();
		}
		await expect(form.getByText('Copy API Key', { exact: true })).toBeVisible();
		const key = form.getByRole('textbox', { name: 'Key', exact: true });
		await expect(key).toBeDisabled();
		await expect(key).toHaveValue(/^\*+$/);
		// Nothing has changed yet, so there is nothing to update.
		await expect(form.getByRole('button', { name: 'Update', exact: true })).toBeDisabled();
		await closeForm();
	});
});
