import { expect, type Page } from '@playwright/test';

export async function signInToTestsigma(page: Page) {
	const email = process.env.TESTSIGMA_EMAIL;
	const password = process.env.TESTSIGMA_PASSWORD;

	if (!email || !password) {
		throw new Error('Set TESTSIGMA_EMAIL and TESTSIGMA_PASSWORD in .env to sign in to TestSigma.');
	}

	await page.goto('./');
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

	const workEmail = page.getByPlaceholder('name@company.com');
	const passwordField = page.getByPlaceholder('Enter Password');
	const signInButton = page.getByRole('button', { name: 'Sign in' });

	await expect(workEmail).toBeVisible();
	await expect(passwordField).toBeVisible();
	await expect(signInButton).toBeEnabled();

	await workEmail.fill(email);
	await passwordField.fill(password);
	await expect(workEmail).toHaveValue(email);
	await expect(passwordField).toHaveValue(password);
	await signInButton.click();

	await page.waitForURL(/\/ui\/v2\//, { timeout: 30000 });
	await expect(page.getByRole('button', { name: 'Share Feedback' })).toBeVisible({ timeout: 30000 });
}
