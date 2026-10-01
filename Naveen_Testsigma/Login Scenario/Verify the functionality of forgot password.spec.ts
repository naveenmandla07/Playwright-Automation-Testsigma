/**
 * The forgot-password page reached from the Sign in page.
 *
 * Scenarios:
 * - Open the page from the "Forgot password" link and check its email field, "Request reset link" button and
 *   "Back to login" link.
 * - Request a reset link for an email and see the "reset link has been sent" confirmation.
 * - Request a reset link with the email empty; the field is flagged as required and the page does not change.
 * - Go back to login with the email empty.
 * - Go back to login after typing an email.
 *
 * Uses made-up example.com addresses, so needs no account.
 */
import { expect, test } from '../pages/fixtures';
import { BasePage } from '../pages/BasePage';

test('[Positive] Verify forgot password page and its controls', async ({ page, loginPage }) => {
	try {
		await loginPage.open();
		await expect(loginPage.emailField).toBeVisible();
		await expect(loginPage.passwordField).toBeVisible();

		const forgotPassword = await loginPage.openForgotPassword();
		await expect(forgotPassword.emailField).toBeVisible();
		await expect(forgotPassword.requestResetLinkButton).toBeVisible();
		await expect(forgotPassword.backToLoginLink).toBeVisible();
		await page.waitForTimeout(5000);
	} catch (error) {
		throw new Error('Forgot-password page and controls scenario failed.', { cause: error });
	}
});

test('[Positive] Request a password reset link with a valid email', async ({ page, loginPage }) => {
	try {
		await loginPage.open();
		const forgotPassword = await loginPage.openForgotPassword();

		await expect(forgotPassword.emailField).toBeVisible();
		await forgotPassword.enterEmail(`forgot-password-${Date.now()}@example.com`);
		await expect(forgotPassword.requestResetLinkButton).toBeEnabled();
		await forgotPassword.requestResetLinkButton.click();

		await expect(forgotPassword.resetLinkSent).toBeVisible({ timeout: 15000 });
		await expect(page).toHaveURL(/\/ui\/forgot_password/);
		await page.waitForTimeout(5000);
	} catch (error) {
		throw new Error('Password reset-link request scenario failed.', { cause: error });
	}
});

test('[Negative] Verify reset-link validation when email is empty', async ({ page, loginPage }) => {
	try {
		await loginPage.open();
		const forgotPassword = await loginPage.openForgotPassword();

		await expect(forgotPassword.emailField).toBeVisible();
		await expect(forgotPassword.emailField).toBeEmpty();
		await forgotPassword.requestResetLinkButton.click();

		await expect.poll(() => BasePage.isMissing(forgotPassword.emailField)).toBe(true);
		await forgotPassword.expectOpen();
		await page.waitForTimeout(5000);
	} catch (error) {
		throw new Error('Empty-email reset-link validation scenario failed.', { cause: error });
	}
});

test('[Positive] Return to login from forgot password with an empty email', async ({ page, loginPage }) => {
	try {
		await loginPage.open();
		const forgotPassword = await loginPage.openForgotPassword();

		await expect(forgotPassword.emailField).toBeEmpty();
		await forgotPassword.backToLogin();
		await page.waitForTimeout(5000);
	} catch (error) {
		throw new Error('Back-to-login navigation with empty email failed.', { cause: error });
	}
});

test('[Positive] Return to login from forgot password after entering an email', async ({ page, loginPage }) => {
	try {
		await loginPage.open();
		const forgotPassword = await loginPage.openForgotPassword();

		await forgotPassword.enterEmail(`back-to-login-${Date.now()}@example.com`);
		await forgotPassword.backToLogin();
		await page.waitForTimeout(5000);
	} catch (error) {
		throw new Error('Back-to-login navigation after entering email failed.', { cause: error });
	}
});
