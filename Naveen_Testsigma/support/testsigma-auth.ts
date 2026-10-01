/**
 * Signing in to Testsigma, for every spec that needs a signed-in page, through the Sign in page's page object.
 */
import { type Page } from '@playwright/test';
import { LoginPage } from '../pages/login/LoginPage';

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

	const loginPage = new LoginPage(page);
	await loginPage.open();
	await loginPage.expectReady();
	await loginPage.signIn(accountEmail, accountPassword);
	await loginPage.expectSignedIn();
}
