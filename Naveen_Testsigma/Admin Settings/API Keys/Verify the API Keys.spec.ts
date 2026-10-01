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
import { expect, test } from '@playwright/test';
import { ApiKeysTab } from '../../pages/settings/tabs/ApiKeysTab';
import { useSettingsTab } from '../../support/admin-settings';

const expirationChoices = ['7 days', '30 days', '90 days', 'Custom', 'Never expires'];

test.describe('Verify the API Keys', () => {
	const run = useSettingsTab(ApiKeysTab);

	test('Open the API Keys tab and check its elements', async () => {
		await run.tab.open();
		await run.tab.expectElements();
	});

	test('Check every key in the list', async () => {
		const rows = run.tab.rows;
		await expect(rows.first()).toBeVisible();
		const count = await rows.count();
		test.info().annotations.push({ type: 'keys', description: `${count} keys` });
		for (let index = 0; index < count; index += 1) {
			const row = rows.nth(index);
			const cells = row.getByRole('gridcell');
			// Each key has a switch for turning it on or off, named after the key.
			const name = await run.tab.keyNameOf(row);
			expect.soft(name, `name of key ${index + 1}`).not.toBe('');
			await expect.soft(run.tab.keySwitch(row, name)).toBeAttached();
			await expect.soft(cells.nth(2), `expiration of ${name}`).toHaveText(/^(Never expires|.*\d.*)$/);
			await expect.soft(cells.nth(3), `parallel allocation of ${name}`).toHaveText(/^(Max available|\d+.*)$/);
			// The key's own buttons only show while it is hovered.
			await row.hover();
			await expect.soft(run.tab.rowButton(row, 'Copy API Key'), `Copy API Key of ${name}`).toBeVisible();
			await expect.soft(run.tab.rowButton(row, 'Edit'), `Edit of ${name}`).toBeVisible();
		}
	});

	test('Open the Generate API Key form and check its fields', async () => {
		const tab = run.tab;
		await tab.openGenerateForm();
		// "Generate API Key" is both the form's title and its button.
		await expect(tab.formText('Generate API Key')).toHaveCount(2);
		await expect(tab.keyName).toBeEmpty();
		await expect(tab.blockParallels).not.toBeChecked();
		await expect(tab.allocateParallels).toBeEmpty();
		await expect(tab.parallelsLeft).toBeVisible();
		await expect(tab.formText('Expiration')).toBeVisible();
		for (const choice of expirationChoices) {
			await expect.soft(tab.expiration(choice), `expiration ${choice}`).toBeVisible();
		}
		// A key needs a name before it can be generated.
		await expect(tab.generateKeyButton).toBeDisabled();
		await expect(tab.closeButton).toBeEnabled();
		await tab.closeForm();
	});

	test('A key can be generated once it has a name', async () => {
		const tab = run.tab;
		await tab.openGenerateForm();
		await tab.keyName.fill('Playwright key that is never generated');
		await expect(tab.generateKeyButton).toBeEnabled();
		await tab.keyName.clear();
		await expect(tab.generateKeyButton).toBeDisabled();
		await tab.closeForm();
	});

	test('Parallels beyond what the account has cannot be allocated', async () => {
		const tab = run.tab;
		await tab.openGenerateForm();
		const available = await tab.availableParallels();
		const tooMany = available + 7;
		await tab.keyName.fill('Playwright key that is never generated');
		await tab.allocateParallels.fill(String(tooMany));
		await expect(tab.formText(`Cannot allocate ${tooMany} parallels, only ${available} are available for allocation`)).toBeVisible();
		await expect(tab.generateKeyButton).toBeDisabled();
		// Allocating what the account has is accepted again.
		await tab.allocateParallels.fill(String(available));
		await expect(tab.formText(/^Cannot allocate/)).toHaveCount(0);
		await expect(tab.generateKeyButton).toBeEnabled();
		await tab.closeForm();
	});

	test('Block Parallels can be turned on and off', async () => {
		const tab = run.tab;
		await tab.openGenerateForm();
		await tab.blockParallelsLabel.click();
		await expect(tab.blockParallels).toBeChecked();
		await tab.blockParallelsLabel.click();
		await expect(tab.blockParallels).not.toBeChecked();
		await tab.closeForm();
	});

	test('Each expiration can be chosen, and Custom asks for a date', async () => {
		const tab = run.tab;
		await tab.openGenerateForm();
		await expect(tab.customDate).toHaveCount(0);
		for (const choice of expirationChoices) {
			await tab.expiration(choice).click();
			if (choice === 'Custom') {
				await expect(tab.customDate).toBeVisible();
			} else {
				await expect(tab.customDate).toHaveCount(0);
			}
		}
		await tab.closeForm();
	});

	test('Edit shows a key\'s details with the key masked', async () => {
		const tab = run.tab;
		// Start from a freshly loaded list, as the earlier checks hovered over it.
		await tab.reopen();
		const row = tab.rows.first();
		const name = await tab.keyNameOf(row);
		await row.hover();
		await tab.rowButton(row, 'Edit').click();
		// The edit form keeps the title of the form that generates keys.
		await expect(tab.formText('Generate API Key').first()).toBeVisible();
		await expect(tab.keyName).toHaveValue(name);
		for (const choice of expirationChoices) {
			await expect.soft(tab.expiration(choice), `expiration ${choice}`).toBeVisible();
		}
		await expect(tab.formText('Copy API Key')).toBeVisible();
		await expect(tab.keyField).toBeDisabled();
		await expect(tab.keyField).toHaveValue(/^\*+$/);
		// Nothing has changed yet, so there is nothing to update.
		await expect(tab.updateButton).toBeDisabled();
		await tab.closeForm();
	});
});
