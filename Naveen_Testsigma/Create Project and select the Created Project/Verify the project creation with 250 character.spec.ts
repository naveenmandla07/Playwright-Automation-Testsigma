/**
 * The 250-character limit on the project name in the New Project form.
 *
 * Scenarios:
 * - A 250-character name is accepted: no length error and Create is enabled.
 * - A 251-character name shows the length error and Create is disabled.
 *
 * Neither project is created, so the account stays clean.
 */
import { expect, test } from '../pages/fixtures';
import type { ProjectSwitcher } from '../pages/projects/ProjectSwitcher';
import { missingCredentials, missingCredentialsMessage, signInToTestsigma } from '../support/testsigma-auth';

// Signs in and fills in the New Project form, all but its name.
async function openNewProjectForm(projectSwitcher: ProjectSwitcher) {
	await signInToTestsigma(projectSwitcher.page);
	await projectSwitcher.open();
	const form = await projectSwitcher.openNewProjectForm();

	await expect(form.nameField).toBeVisible();
	await form.descriptionField.fill('Boundary validation test project.');
	await form.applicationNameField.fill('Web App');
	await form.applicationVersionField.fill('classic web');
	await form.engine('Classic').click();
	return form;
}

const lengthError = /project name.*250.*character|250.*character.*project name/i;

// 250 characters is the maximum allowed length, so it is accepted; the project is not created to keep the account clean.
test('[Naveen] Project name with 250 characters is accepted', async ({ page, projectSwitcher }) => {
	test.skip(missingCredentials, missingCredentialsMessage);

	const form = await openNewProjectForm(projectSwitcher);
	await form.nameField.fill('P'.repeat(250));
	await form.nameField.blur();

	await expect(form.nameField).toHaveValue('P'.repeat(250));
	await expect(page.getByText(lengthError)).toBeHidden();
	await expect(form.createButton).toBeEnabled();
});

test('[Naveen] Project name with 251 characters cannot be created', async ({ page, projectSwitcher }) => {
	test.skip(missingCredentials, missingCredentialsMessage);

	const form = await openNewProjectForm(projectSwitcher);
	await form.nameField.fill('P'.repeat(251));
	await form.nameField.blur();

	await expect(form.nameField).toHaveValue('P'.repeat(251));
	await expect(page.getByText(lengthError)).toBeVisible();
	await expect(form.createButton).toBeDisabled();
});
