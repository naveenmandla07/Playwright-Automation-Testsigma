import { expect, test } from '@playwright/test';

test('[Negative] Verify the TestSigma login functionality with empty fields', async ({ page }) => {
	try {
		await page.goto('./');
		await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

		const workEmail = page.getByPlaceholder('name@company.com');
		const passwordField = page.getByPlaceholder('Enter Password');
		const signInButton = page.getByRole('button', { name: 'Sign in' });

		await expect(workEmail).toBeVisible();
		await expect(passwordField).toBeVisible();
		await expect(workEmail).toBeEmpty();
		await expect(passwordField).toBeEmpty();
		await expect(signInButton).toBeEnabled();

		await signInButton.click();

		await expect.poll(() => workEmail.evaluate((input) => (input as HTMLInputElement).validity.valueMissing)).toBe(true);
		await expect.poll(() => passwordField.evaluate((input) => (input as HTMLInputElement).validity.valueMissing)).toBe(true);
		await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
		await expect(page).toHaveURL(/\/ui\/$/);
	} catch (error) {
		throw new Error('Negative empty-fields TestSigma login scenario failed.', { cause: error });
	}
});
