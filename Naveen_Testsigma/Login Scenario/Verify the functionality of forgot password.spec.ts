import { expect, test, type Page } from '@playwright/test';

async function openForgotPassword(page: Page) {
	await page.goto('./');
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

	const forgotPasswordLink = page.getByRole('link', { name: /forgot password/i });
	await expect(forgotPasswordLink).toBeVisible();
	await expect(forgotPasswordLink).toBeEnabled();
	await forgotPasswordLink.click();

	await expect(page).toHaveURL(/\/ui\/forgot_password/);
	await expect(page.getByRole('heading', { name: /forgot your password/i })).toBeVisible();
}

test('[Positive] Verify forgot password page and its controls', async ({ page }) => {
	try {
		await page.goto('./');
		await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
		await expect(page.getByPlaceholder('name@company.com')).toBeVisible();
		await expect(page.getByPlaceholder('Enter Password')).toBeVisible();

		const forgotPasswordLink = page.getByRole('link', { name: /forgot password/i });
		await expect(forgotPasswordLink).toBeVisible();
		await expect(forgotPasswordLink).toBeEnabled();
		await forgotPasswordLink.click();

		await expect(page).toHaveURL(/\/ui\/forgot_password/);
		await expect(page.getByRole('heading', { name: /forgot your password/i })).toBeVisible();
		await expect(page.getByPlaceholder('name@company.com')).toBeVisible();
		await expect(page.getByRole('button', { name: /request reset link/i })).toBeVisible();
		await expect(page.getByRole('link', { name: /back to login/i })).toBeVisible();
		await page.waitForTimeout(5000);
	} catch (error) {
		throw new Error('Forgot-password page and controls scenario failed.', { cause: error });
	}
});

test('[Positive] Request a password reset link with a valid email', async ({ page }) => {
	try {
		await openForgotPassword(page);

		const emailField = page.getByPlaceholder('name@company.com');
		const requestButton = page.getByRole('button', { name: /request reset link/i });
		const testEmail = `forgot-password-${Date.now()}@example.com`;

		await expect(emailField).toBeVisible();
		await emailField.fill(testEmail);
		await expect(emailField).toHaveValue(testEmail);
		await expect(requestButton).toBeEnabled();
		await requestButton.click();

		await expect(page.getByText('An email with password reset link has been sent to you')).toBeVisible({ timeout: 15000 });
		await expect(page).toHaveURL(/\/ui\/forgot_password/);
		await page.waitForTimeout(5000);
	} catch (error) {
		throw new Error('Password reset-link request scenario failed.', { cause: error });
	}
});

test('[Negative] Verify reset-link validation when email is empty', async ({ page }) => {
	try {
		await openForgotPassword(page);

		const emailField = page.getByPlaceholder('name@company.com');
		await expect(emailField).toBeVisible();
		await expect(emailField).toBeEmpty();
		await page.getByRole('button', { name: /request reset link/i }).click();

		await expect.poll(() => emailField.evaluate((input) => (input as HTMLInputElement).validity.valueMissing)).toBe(true);
		await expect(page.getByRole('heading', { name: /forgot your password/i })).toBeVisible();
		await expect(page).toHaveURL(/\/ui\/forgot_password/);
		await page.waitForTimeout(5000);
	} catch (error) {
		throw new Error('Empty-email reset-link validation scenario failed.', { cause: error });
	}
});

test('[Positive] Return to login from forgot password with an empty email', async ({ page }) => {
	try {
		await openForgotPassword(page);

		const emailField = page.getByPlaceholder('name@company.com');
		await expect(emailField).toBeEmpty();
		await page.getByRole('link', { name: /back to login/i }).click();

		await expect(page).toHaveURL(/\/ui\/login/);
		await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
		await page.waitForTimeout(5000);
	} catch (error) {
		throw new Error('Back-to-login navigation with empty email failed.', { cause: error });
	}
});

test('[Positive] Return to login from forgot password after entering an email', async ({ page }) => {
	try {
		await openForgotPassword(page);

		const emailField = page.getByPlaceholder('name@company.com');
		const testEmail = `back-to-login-${Date.now()}@example.com`;
		await emailField.fill(testEmail);
		await expect(emailField).toHaveValue(testEmail);
		await page.getByRole('link', { name: /back to login/i }).click();

		await expect(page).toHaveURL(/\/ui\/login/);
		await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
		await page.waitForTimeout(5000);
	} catch (error) {
		throw new Error('Back-to-login navigation after entering email failed.', { cause: error });
	}
});
