/**
 * Signing in to Testsigma, for every spec that needs a signed-in page. The Login Scenario specs test the sign-in
 * page itself, so they keep their own steps and only share the account's details from here.
 */
import { expect, type Page } from '@playwright/test';

// The account the specs sign in as, from .env.
export const accountEmail = process.env.TESTSIGMA_EMAIL ?? '';
export const accountPassword = process.env.TESTSIGMA_PASSWORD ?? '';

// Specs that sign in are skipped, with this message, when .env does not give the account.
export const missingCredentials = !accountEmail || !accountPassword;
export const missingCredentialsMessage = 'Set TESTSIGMA_EMAIL and TESTSIGMA_PASSWORD in .env to run this test.';

// The news widget's prompt can cover the page at any time and cannot always be dismissed, so the widget is kept
// from loading at all. This lasts for the page's life, reloads included.
export async function blockNewsWidget(page: Page) {
	await page.route(/getbeamer\.com/, (route) => route.abort());
}

export async function signInToTestsigma(page: Page) {
	if (missingCredentials) {
		throw new Error('Set TESTSIGMA_EMAIL and TESTSIGMA_PASSWORD in .env to sign in to TestSigma.');
	}
	await blockNewsWidget(page);

	await page.goto('./');
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

	const workEmail = page.getByPlaceholder('name@company.com');
	const passwordField = page.getByPlaceholder('Enter Password');
	const signInButton = page.getByRole('button', { name: 'Sign in' });

	await expect(workEmail).toBeVisible();
	await expect(passwordField).toBeVisible();
	await expect(signInButton).toBeEnabled();

	await workEmail.fill(accountEmail);
	await passwordField.fill(accountPassword);
	await expect(workEmail).toHaveValue(accountEmail);
	await expect(passwordField).toHaveValue(accountPassword);
	await signInButton.click();

	await page.waitForURL(/\/ui\/v2\//, { timeout: 30000 });
	await expect(page.getByRole('button', { name: 'Share Feedback' })).toBeVisible({ timeout: 30000 });
}
