/**
 * Signing in to and out of Testsigma with a valid account.
 *
 * Scenarios:
 * - Sign in with the TESTSIGMA_EMAIL / TESTSIGMA_PASSWORD account and land in the app.
 * - Sign in, open the profile menu from the side navigation and log out back to the Sign in page.
 *
 * Skipped when the credentials are not set in .env.
 */
import { expect, test } from '../pages/fixtures';
import { accountEmail, accountPassword, missingCredentials, missingCredentialsMessage } from '../support/testsigma-auth';

test('[Positive] Verify the TestSigma login functionality with valid details', async ({ page, loginPage }) => {
	test.skip(missingCredentials, missingCredentialsMessage);

	try {
		await loginPage.open();
		await loginPage.expectReady();

		await loginPage.signIn(accountEmail, accountPassword);
		await page.waitForTimeout(10000);

		await expect(page).toHaveURL(/https:\/\/app\.testsigma\.com\/ui\//, { timeout: 30000 });
	} catch (error) {
		throw new Error('Positive TestSigma login scenario failed.', { cause: error });
	}
});

test('[Positive] Verify logout from the TestSigma dashboard', async ({ page, loginPage, sideNavigation }) => {
	test.skip(missingCredentials, missingCredentialsMessage);

	try {
		await loginPage.open();
		await loginPage.signIn(accountEmail, accountPassword);
		await loginPage.expectSignedIn();

		await sideNavigation.logOut();

		await expect(loginPage.heading).toBeVisible({ timeout: 30000 });
		await expect(page).toHaveURL(/https:\/\/id\.testsigma\.com\/ui\/login/);
	} catch (error) {
		throw new Error('TestSigma dashboard logout scenario failed.', { cause: error });
	}
});
