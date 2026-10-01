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
import { PhoneNumbersTab } from '../../pages/settings/tabs/PhoneNumbersTab';
import { useSettingsTab } from '../../support/admin-settings';

test.describe('Verify the Phone Numbers', () => {
	const run = useSettingsTab(PhoneNumbersTab);

	test('Open the Phone Numbers (TFA) tab and check its elements', async () => {
		await run.tab.open();
		await run.tab.expectElements();
	});

	test('The documentation link opens in a new tab', async () => {
		const guide = run.tab.guide;
		await expect(guide).toHaveAttribute('href', 'https://testsigma.com/docs/test-data/types/phone-number/');
		await expect(guide).toHaveAttribute('target', '_blank');
		// The link sits inside its sentence, which carries on after it.
		await expect(run.tab.text(/Click here\s*for a Simple Use Case$/)).toBeVisible();
	});

	test('Check the phone numbers, or how to ask for some', async () => {
		const noNumbers = run.tab.noNumbers;
		if (!(await noNumbers.isVisible())) {
			await expect(run.tab.table).toBeVisible();
			test.info().annotations.push({ type: 'phone numbers', description: `${await run.tab.rows.count()} listed` });
			return;
		}
		test.info().annotations.push({ type: 'phone numbers', description: 'none' });
		await expect(run.tab.noNumbersIllustration).toBeVisible();
		await expect(run.tab.text(/^For provisioning Phone Numbers, Please Contact Testsigma Support Via/)).toBeVisible();
		await expect(run.tab.chatLink).toHaveAttribute('href', 'javascript:fcWidget.open()');
		await expect(run.tab.text(/Via\s*Chat\s*or Email US at\s*support@testsigma\.com$/)).toBeVisible();
		const email = run.tab.supportEmail;
		await expect(email).toHaveAttribute('href', 'mailto:support@testsigma.com');
		await expect(email).toHaveAttribute('target', '_blank');
	});
});
