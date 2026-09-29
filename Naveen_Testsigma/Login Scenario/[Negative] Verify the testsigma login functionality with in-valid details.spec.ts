/**
 * Signing in with an unknown email and a wrong password.
 *
 * Scenario:
 * - Sign in with a made-up email and password; the "Please enter a valid email address" error is shown and the
 *   user stays on the Sign in page.
 *
 * Needs no account.
 */
import { expect, test } from '@playwright/test';

test('[Negative] Verify the TestSigma login functionality with invalid details', async ({ page }) => {
	try {
		await page.goto('./');
		await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

		const workEmail = page.getByPlaceholder('name@company.com');
		const passwordField = page.getByPlaceholder('Enter Password');
		const signInButton = page.getByRole('button', { name: 'Sign in' });
		const invalidEmail = `invalid-user-${Date.now()}@example.com`;

		await expect(workEmail).toBeVisible();
		await expect(passwordField).toBeVisible();
		await expect(signInButton).toBeEnabled();

		await workEmail.fill(invalidEmail);
		await passwordField.fill('InvalidPassword123!');
		await expect(workEmail).toHaveValue(invalidEmail);
		await expect(passwordField).toHaveValue('InvalidPassword123!');

		await signInButton.click();
		await page.waitForTimeout(5000);

		await expect(page.getByText('Please enter a valid email address')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
		await expect(page).toHaveURL(/\/ui\/$/);
	} catch (error) {
		throw new Error('Negative invalid-details TestSigma login scenario failed.', { cause: error });
	}
});
