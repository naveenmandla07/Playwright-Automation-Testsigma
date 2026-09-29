/**
 * Signing in to and out of Testsigma with a valid account.
 *
 * Scenarios:
 * - Sign in with the TESTSIGMA_EMAIL / TESTSIGMA_PASSWORD account and land in the app.
 * - Sign in, open the profile menu from the side navigation and log out back to the Sign in page.
 *
 * Skipped when the credentials are not set in .env.
 */
import { expect, test } from '@playwright/test';

const email = process.env.TESTSIGMA_EMAIL;
const password = process.env.TESTSIGMA_PASSWORD;

test('[Positive] Verify the TestSigma login functionality with valid details', async ({ page }) => {
	test.skip(!email || !password, 'Set TESTSIGMA_EMAIL and TESTSIGMA_PASSWORD in .env to run this test.');

	try {
		await page.goto('./');
		await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

		const workEmail = page.getByPlaceholder('name@company.com');
		const passwordField = page.getByPlaceholder('Enter Password');
		const signInButton = page.getByRole('button', { name: 'Sign in' });

		await expect(workEmail).toBeVisible();
		await expect(passwordField).toBeVisible();
		await expect(signInButton).toBeEnabled();

		await workEmail.fill(email!);
		await passwordField.fill(password!);
		await expect(workEmail).toHaveValue(email!);
		await expect(passwordField).toHaveValue(password!);

		await signInButton.click();
		await page.waitForTimeout(10000);

		await expect(page).toHaveURL(/https:\/\/app\.testsigma\.com\/ui\//, { timeout: 30000 });
	} catch (error) {
		throw new Error('Positive TestSigma login scenario failed.', { cause: error });
	}
});

test('[Positive] Verify logout from the TestSigma dashboard', async ({ page }) => {
	test.skip(!email || !password, 'Set TESTSIGMA_EMAIL and TESTSIGMA_PASSWORD in .env to run this test.');

	try {
		await page.goto('./');
		await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

		await page.getByPlaceholder('name@company.com').fill(email!);
		await page.getByPlaceholder('Enter Password').fill(password!);
		await page.getByRole('button', { name: 'Sign in' }).click();

		await page.waitForURL(/\/ui\/v2\//, { timeout: 30000 });
		await expect(page.getByRole('button', { name: 'Share Feedback' })).toBeVisible({ timeout: 30000 });

		const viewport = page.viewportSize();
		await page.mouse.move(20, (viewport?.height ?? 720) - 20);

		// The profile menu shows the user's initial, name and role; match its structure so any account works.
		const profileIcon = page.getByRole('navigation').locator('div.cursor-pointer')
			.filter({ has: page.getByTestId('angle-right') })
			.filter({ has: page.getByText(/^[A-Z]$/) });
		await expect(profileIcon).toBeVisible();
		await profileIcon.click();

		const logoutOption = page.getByText('Logout', { exact: true });
		await expect(logoutOption).toBeVisible();
		await logoutOption.click();

		await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 30000 });
		await expect(page).toHaveURL(/https:\/\/id\.testsigma\.com\/ui\/login/);
	} catch (error) {
		throw new Error('TestSigma dashboard logout scenario failed.', { cause: error });
	}
});
