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

for (const characterCount of [250, 251]) {
	test(`[Naveen] Project name with ${characterCount} characters cannot be created`, async ({ page }) => {
		test.skip(!email || !password, 'Set TESTSIGMA_EMAIL and TESTSIGMA_PASSWORD in .env to run this test.');

		const projectNameField = await openNewProjectForm(page);
		await projectNameField.fill('P'.repeat(characterCount));
		await projectNameField.blur();

		await expect(projectNameField).toHaveValue('P'.repeat(characterCount));
		await expect(page.getByText(/project name.*250.*character|250.*character.*project name/i)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
	});
}
