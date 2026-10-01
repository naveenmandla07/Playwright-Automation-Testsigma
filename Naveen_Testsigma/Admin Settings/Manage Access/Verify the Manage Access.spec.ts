/**
 * The Manage Access tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Manage Access tab and check its elements.
 * - Check whether Testsigma support may sign in to the account, and that the button offered changes it the other
 *   way: allowing access when it is denied, and taking it back when it is allowed.
 *
 * Whether support may sign in is the account's own choice, so the button is checked but never clicked.
 */
import { expect, test } from '@playwright/test';
import { ManageAccessTab } from '../../pages/settings/tabs/ManageAccessTab';
import { useSettingsTab } from '../../support/admin-settings';

test.describe('Verify the Manage Access', () => {
	const run = useSettingsTab(ManageAccessTab);

	test('Open the Manage Access tab and check its elements', async () => {
		await run.tab.open();
		await run.tab.expectElements();
		await expect(run.tab.introduction)
			.toHaveText('To assist with support issues, our team may require access to your account. You can manage access permissions in this section.');
	});

	test('Check whether support may sign in to the account', async () => {
		await expect(run.tab.text('Current Status')).toBeVisible();
		const status = run.tab.status;
		await expect(status).toBeVisible();
		const denied = (await status.innerText()).trim() === 'Access Denied';
		test.info().annotations.push({ type: 'support access', description: (await status.innerText()).trim() });
		// The button changes the status the other way.
		if (denied) {
			await expect(run.tab.allowButton).toBeEnabled();
			await expect(run.tab.revokeButton).toHaveCount(0);
		} else {
			await expect(run.tab.revokeButton).toBeEnabled();
			await expect(run.tab.allowButton).toHaveCount(0);
		}
	});
});
