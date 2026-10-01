/**
 * Signing in with an unknown email and a wrong password.
 *
 * Scenario:
 * - Sign in with a made-up email and password; the "Please enter a valid email address" error is shown and the
 *   user stays on the Sign in page.
 *
 * Needs no account.
 */
import { expect, test } from '../pages/fixtures';

test('[Negative] Verify the TestSigma login functionality with invalid details', async ({ page, loginPage }) => {
	try {
		await loginPage.open();
		await loginPage.expectReady();

		await loginPage.signIn(`invalid-user-${Date.now()}@example.com`, 'InvalidPassword123!');
		await page.waitForTimeout(5000);

		await expect(loginPage.invalidDetailsError).toBeVisible();
		await expect(loginPage.heading).toBeVisible();
		await expect(page).toHaveURL(/\/ui\/$/);
	} catch (error) {
		throw new Error('Negative invalid-details TestSigma login scenario failed.', { cause: error });
	}
});
