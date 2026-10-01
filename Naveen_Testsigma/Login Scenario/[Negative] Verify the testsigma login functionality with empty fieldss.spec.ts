/**
 * Signing in with the email and password left empty.
 *
 * Scenario:
 * - Click Sign in with both fields empty; the browser flags both fields as required and the user stays on the
 *   Sign in page.
 *
 * Needs no account.
 */
import { expect, test } from '../pages/fixtures';
import { BasePage } from '../pages/BasePage';

test('[Negative] Verify the TestSigma login functionality with empty fields', async ({ page, loginPage }) => {
	try {
		await loginPage.open();
		await loginPage.expectReady();
		await expect(loginPage.emailField).toBeEmpty();
		await expect(loginPage.passwordField).toBeEmpty();

		await loginPage.signInButton.click();

		await expect.poll(() => BasePage.isMissing(loginPage.emailField)).toBe(true);
		await expect.poll(() => BasePage.isMissing(loginPage.passwordField)).toBe(true);
		await expect(loginPage.heading).toBeVisible();
		await expect(page).toHaveURL(/\/ui\/$/);
	} catch (error) {
		throw new Error('Negative empty-fields TestSigma login scenario failed.', { cause: error });
	}
});
