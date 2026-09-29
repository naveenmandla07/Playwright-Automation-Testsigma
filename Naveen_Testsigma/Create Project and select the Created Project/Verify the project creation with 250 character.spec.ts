/**
 * The 250-character limit on the project name in the New Project form.
 *
 * Scenarios:
 * - A 250-character name is accepted: no length error and Create is enabled.
 * - A 251-character name shows the length error and Create is disabled.
 *
 * Neither project is created, so the account stays clean.
 */
import { expect, test, type Page } from '@playwright/test';

const email = process.env.TESTSIGMA_EMAIL;
const password = process.env.TESTSIGMA_PASSWORD;

async function dismissNewsNotification(page: Page) {
	const notificationPrompt = page.getByText("We'd like to show you notifications for the latest news and updates.", { exact: true });
	const noThanksButton = page.getByRole('button', { name: /no,? thanks/i });

	if (await notificationPrompt.isVisible()) {
		await expect(noThanksButton).toBeVisible();
		await noThanksButton.click();
		await expect(notificationPrompt).toBeHidden();
	}
}

async function openNewProjectForm(page: Page) {
	await page.goto('./');
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
	await page.getByPlaceholder('name@company.com').fill(email!);
	await page.getByPlaceholder('Enter Password').fill(password!);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/ui\/v2\//, { timeout: 30000 });
	await expect(page.getByRole('button', { name: 'Share Feedback' })).toBeVisible({ timeout: 30000 });
	await dismissNewsNotification(page);

	await page.mouse.move(20, 100);
	const projectApplicationTab = page.locator('[role="button"]').filter({ has: page.locator('[data-testid="web"]') });
	await expect(projectApplicationTab).toBeVisible();
	await projectApplicationTab.click();
	await page.getByRole('button', { name: 'New Project' }).click();

	const projectNameField = page.getByRole('textbox', { name: 'Project name' });
	const descriptionField = page.locator('textarea');
	const applicationNameField = page.getByRole('textbox', { name: 'Web application' });
	const applicationVersionField = page.getByRole('textbox', { name: 'Production' });
	const classicEngine = page.getByRole('button').filter({ has: page.getByText('Classic', { exact: true }) });

	await expect(projectNameField).toBeVisible();
	await descriptionField.fill('Boundary validation test project.');
	await applicationNameField.fill('Web App');
	await applicationVersionField.fill('classic web');
	await classicEngine.click();
	return projectNameField;
}

const lengthError = /project name.*250.*character|250.*character.*project name/i;

// 250 characters is the maximum allowed length, so it is accepted; the project is not created to keep the account clean.
test('[Naveen] Project name with 250 characters is accepted', async ({ page }) => {
	test.skip(!email || !password, 'Set TESTSIGMA_EMAIL and TESTSIGMA_PASSWORD in .env to run this test.');

	const projectNameField = await openNewProjectForm(page);
	await projectNameField.fill('P'.repeat(250));
	await projectNameField.blur();

	await expect(projectNameField).toHaveValue('P'.repeat(250));
	await expect(page.getByText(lengthError)).toBeHidden();
	await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeEnabled();
});

test('[Naveen] Project name with 251 characters cannot be created', async ({ page }) => {
	test.skip(!email || !password, 'Set TESTSIGMA_EMAIL and TESTSIGMA_PASSWORD in .env to run this test.');

	const projectNameField = await openNewProjectForm(page);
	await projectNameField.fill('P'.repeat(251));
	await projectNameField.blur();

	await expect(projectNameField).toHaveValue('P'.repeat(251));
	await expect(page.getByText(lengthError)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
});
