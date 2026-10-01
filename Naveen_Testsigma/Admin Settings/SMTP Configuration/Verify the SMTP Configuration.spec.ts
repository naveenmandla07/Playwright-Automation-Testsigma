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
import { SmtpConfigurationTab } from '../../pages/settings/tabs/SmtpConfigurationTab';
import { useSettingsTab } from '../../support/admin-settings';

test.describe('Verify the SMTP Configuration', () => {
	const run = useSettingsTab(SmtpConfigurationTab);

	test('Open the SMTP Configuration tab and check its elements', async () => {
		await run.tab.open();
		await run.tab.expectElements();
	});

	test('Check the two ways of sending mail', async () => {
		await expect(run.tab.testsigmaLogo).toBeVisible();
		await expect(run.tab.text('Testsigma').last()).toBeVisible();
		await expect(run.tab.text('Choose this option to receive emails on Testsigma\'s server')).toBeVisible();
		await expect(run.tab.ownServerIcon).toBeVisible();
		await expect(run.tab.text('Own')).toBeVisible();
		await expect(run.tab.text('Configure SMTP to receive emails where you want them')).toBeVisible();
		await expect(run.tab.smtpSwitch).toBeVisible();
	});

	test('Check which way is in use', async () => {
		const ownServer = run.tab.ownServer;
		if (await run.tab.smtpDisabled.isVisible()) {
			// Mail goes through Testsigma's server, so there is nothing to configure.
			test.info().annotations.push({ type: 'mail', description: 'sent by Testsigma' });
			await expect(run.tab.text('Mails will be sent from the Testsigma domain')).toBeVisible();
			await expect(run.tab.text(/^This is a convenient option for users who prefer to use Testsigma's built-in mail server/)).toBeVisible();
			await expect(ownServer).toHaveCount(0);
		} else {
			test.info().annotations.push({ type: 'mail', description: 'sent by the account\'s own SMTP server' });
			await expect(ownServer).toBeVisible();
		}
	});
});
