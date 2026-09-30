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
import { missingCredentials, missingCredentialsMessage, signInToTestsigma } from '../support/testsigma-auth';


async function openNewProjectForm(page: Page) {
	await signInToTestsigma(page);

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
	test.skip(missingCredentials, missingCredentialsMessage);

	const projectNameField = await openNewProjectForm(page);
	await projectNameField.fill('P'.repeat(250));
	await projectNameField.blur();

	await expect(projectNameField).toHaveValue('P'.repeat(250));
	await expect(page.getByText(lengthError)).toBeHidden();
	await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeEnabled();
});

test('[Naveen] Project name with 251 characters cannot be created', async ({ page }) => {
	test.skip(missingCredentials, missingCredentialsMessage);

	const projectNameField = await openNewProjectForm(page);
	await projectNameField.fill('P'.repeat(251));
	await projectNameField.blur();

	await expect(projectNameField).toHaveValue('P'.repeat(251));
	await expect(page.getByText(lengthError)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
});
