/**
 * The SMTP Configuration tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the SMTP Configuration tab and check its elements.
 * - Check the two ways of sending mail, Testsigma's server or the account's own, each with what it means.
 * - Check which way is in use and what is shown for it.
 *
 * How the account sends mail applies as soon as it is changed, so nothing on this tab is clicked.
 */
import { expect, test } from '@playwright/test';
import { expectTabElements, openTab, useSettingsTab } from '../../support/admin-settings';

test.describe('Verify the SMTP Configuration', () => {
	const run = useSettingsTab('SMTP Configuration');

	test('Open the SMTP Configuration tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
	});

	test('Check the two ways of sending mail', async () => {
		await expect(run.main.getByRole('img', { name: 'Testsigma logo' }).last()).toBeVisible();
		await expect(run.main.getByText('Testsigma', { exact: true }).last()).toBeVisible();
		await expect(run.main.getByText('Choose this option to receive emails on Testsigma\'s server', { exact: true })).toBeVisible();
		await expect(run.main.getByTestId('alternate-email')).toBeVisible();
		await expect(run.main.getByText('Own', { exact: true })).toBeVisible();
		await expect(run.main.getByText('Configure SMTP to receive emails where you want them', { exact: true })).toBeVisible();
		// SMTP is turned on or off by a switch beside the tab's title.
		await expect(run.main.getByTestId('toggle-switch')).toBeVisible();
	});

	test('Check which way is in use', async () => {
		const ownServer = run.main.getByRole('textbox').first();
		if (await run.main.getByRole('img', { name: 'SMTP disabled illustration' }).isVisible()) {
			// Mail goes through Testsigma's server, so there is nothing to configure.
			test.info().annotations.push({ type: 'mail', description: 'sent by Testsigma' });
			await expect(run.main.getByText('Mails will be sent from the Testsigma domain', { exact: true })).toBeVisible();
			await expect(run.main.getByText(/^This is a convenient option for users who prefer to use Testsigma's built-in mail server/)).toBeVisible();
			await expect(ownServer).toHaveCount(0);
		} else {
			test.info().annotations.push({ type: 'mail', description: 'sent by the account\'s own SMTP server' });
			await expect(ownServer).toBeVisible();
		}
	});
});
