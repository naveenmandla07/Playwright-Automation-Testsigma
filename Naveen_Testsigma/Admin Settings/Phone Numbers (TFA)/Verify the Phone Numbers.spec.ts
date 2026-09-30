/**
 * The Phone Numbers (TFA) tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Phone Numbers (TFA) tab and check its elements.
 * - Check the link to the documentation on using phone numbers in test cases opens in a new tab.
 * - Check the phone numbers listed or, when there are none, how to ask Testsigma support for some: by chat or by
 *   email.
 *
 * Only looks: the links are checked for where they lead rather than followed, so no chat is started and no email
 * is written. Phone numbers are provisioned by Testsigma for the account, so either state can be shown.
 */
import { expect, test } from '@playwright/test';
import { expectTabElements, openTab, useSettingsTab } from '../../support/admin-settings';

test.describe('Verify the Phone Numbers', () => {
	const run = useSettingsTab('Phone Numbers (TFA)');

	test('Open the Phone Numbers (TFA) tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
	});

	test('The documentation link opens in a new tab', async () => {
		const guide = run.main.getByRole('link', { name: 'Click here', exact: true });
		await expect(guide).toHaveAttribute('href', 'https://testsigma.com/docs/test-data/types/phone-number/');
		await expect(guide).toHaveAttribute('target', '_blank');
		// The link sits inside its sentence, which carries on after it.
		await expect(run.main.getByText(/Click here\s*for a Simple Use Case$/)).toBeVisible();
	});

	test('Check the phone numbers, or how to ask for some', async () => {
		const noNumbers = run.main.getByText('There are no Phone Numbers', { exact: true });
		if (!(await noNumbers.isVisible())) {
			await expect(run.main.getByRole('grid')).toBeVisible();
			test.info().annotations.push({ type: 'phone numbers', description: `${await run.main.getByRole('grid').getByRole('row').getByRole('row').count()} listed` });
			return;
		}
		test.info().annotations.push({ type: 'phone numbers', description: 'none' });
		await expect(run.main.getByRole('img', { name: 'messageText illustration' })).toBeVisible();
		await expect(run.main.getByText(/^For provisioning Phone Numbers, Please Contact Testsigma Support Via/)).toBeVisible();
		// The chat link opens Testsigma's support chat on the page.
		await expect(run.main.getByRole('link', { name: 'Chat', exact: true })).toHaveAttribute('href', 'javascript:fcWidget.open()');
		await expect(run.main.getByText(/Via\s*Chat\s*or Email US at\s*support@testsigma\.com$/)).toBeVisible();
		const email = run.main.getByRole('link', { name: 'support@testsigma.com', exact: true });
		await expect(email).toHaveAttribute('href', 'mailto:support@testsigma.com');
		await expect(email).toHaveAttribute('target', '_blank');
	});
});
