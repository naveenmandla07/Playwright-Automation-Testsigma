/**
 * The forgot-password page, reached from the Sign in page, which sends a link for resetting the password.
 */
import { expect } from '@playwright/test';
import { BasePage } from '../BasePage';

export class ForgotPasswordPage extends BasePage {
	readonly heading = this.page.getByRole('heading', { name: /forgot your password/i });
	readonly emailField = this.page.getByPlaceholder('name@company.com');
	readonly requestResetLinkButton = this.page.getByRole('button', { name: /request reset link/i });
	readonly backToLoginLink = this.page.getByRole('link', { name: /back to login/i });
	readonly resetLinkSent = this.page.getByText('An email with password reset link has been sent to you');

	async expectOpen() {
		await expect(this.page).toHaveURL(/\/ui\/forgot_password/);
		await expect(this.heading).toBeVisible();
	}

	// Fills in the email and checks it was taken.
	async enterEmail(email: string) {
		await this.emailField.fill(email);
		await expect(this.emailField).toHaveValue(email);
	}

	// Going back lands on the Sign in page.
	async backToLogin() {
		await this.backToLoginLink.click();
		await expect(this.page).toHaveURL(/\/ui\/login/);
		await expect(this.page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
	}
}
