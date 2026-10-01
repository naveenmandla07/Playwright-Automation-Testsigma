/**
 * The Sign in page, where Testsigma starts when signed out.
 */
import { expect } from '@playwright/test';
import { BasePage } from '../BasePage';
import { ForgotPasswordPage } from './ForgotPasswordPage';

export class LoginPage extends BasePage {
	readonly heading = this.page.getByRole('heading', { name: 'Sign in' });
	readonly emailField = this.page.getByPlaceholder('name@company.com');
	readonly passwordField = this.page.getByPlaceholder('Enter Password');
	readonly signInButton = this.page.getByRole('button', { name: 'Sign in' });
	readonly forgotPasswordLink = this.page.getByRole('link', { name: /forgot password/i });
	// Shown when the email and password do not belong to an account.
	readonly invalidDetailsError = this.page.getByText('Please enter a valid email address');

	async open() {
		await this.page.goto('./');
		await expect(this.heading).toBeVisible();
	}

	// The form is ready to be filled in.
	async expectReady() {
		await expect(this.emailField).toBeVisible();
		await expect(this.passwordField).toBeVisible();
		await expect(this.signInButton).toBeEnabled();
	}

	// Fills in the email and password, checks they were taken, and signs in.
	async signIn(email: string, password: string) {
		await this.emailField.fill(email);
		await this.passwordField.fill(password);
		await expect(this.emailField).toHaveValue(email);
		await expect(this.passwordField).toHaveValue(password);
		await this.signInButton.click();
	}

	// Signing in lands on the app, which is ready once its header shows.
	async expectSignedIn() {
		await this.page.waitForURL(/\/ui\/v2\//, { timeout: 30000 });
		await expect(this.page.getByRole('button', { name: 'Share Feedback' })).toBeVisible({ timeout: 30000 });
	}

	async openForgotPassword() {
		await expect(this.forgotPasswordLink).toBeVisible();
		await expect(this.forgotPasswordLink).toBeEnabled();
		await this.forgotPasswordLink.click();
		const forgotPassword = new ForgotPasswordPage(this.page);
		await forgotPassword.expectOpen();
		return forgotPassword;
	}
}
