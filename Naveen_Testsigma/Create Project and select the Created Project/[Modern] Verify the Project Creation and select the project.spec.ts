/**
 * Creating a web project on the Modern engine and selecting it from the project switcher.
 *
 * Scenario:
 * - Sign in and open the project switcher; check its Project, Application and Version dropdowns and buttons.
 * - Create "Testsigma_New_Project_1_Modern" (application "Web App", version "modern web", Modern engine), or
 *   switch to it when it already exists.
 * - Selecting another project enables "Go to project"; selecting the created project shows its application and
 *   version and leaves "Go to project" disabled, since it is already current.
 *
 * The project is kept between runs. Runs in the serial chromium-projects project because it changes the
 * account's current project.
 */
import { expect, test } from '@playwright/test';
import { missingCredentials, missingCredentialsMessage, signInToTestsigma } from '../support/testsigma-auth';

const projectName = 'Testsigma_New_Project_1_Modern';

test('[Modern] Verify Testsigma_New_Project_1_Modern creation and selection', async ({ page }) => {
	test.skip(missingCredentials, missingCredentialsMessage);

	try {
		await signInToTestsigma(page);

		await page.mouse.move(20, 100);
		const projectApplicationTab = page.locator('[role="button"]').filter({ has: page.locator('[data-testid="web"]') });
		await expect(projectApplicationTab).toBeVisible();
		await projectApplicationTab.click();

		const projectDropdown = page.getByText('Project', { exact: true }).locator('..').locator('[data-isopen]');
		const applicationDropdown = page.getByText('Application', { exact: true }).locator('..').locator('[data-isopen]');
		const versionDropdown = page.getByText('Version', { exact: true }).locator('..').locator('[data-isopen]');
		const projectSettings = page.getByRole('button', { name: 'Project Settings' });
		const newProjectButton = page.getByRole('button', { name: 'New Project' });
		const goToProjectButton = page.getByRole('button', { name: 'Go to project' });

		await expect(projectDropdown).toBeVisible();
		await expect(applicationDropdown).toBeVisible();
		await expect(versionDropdown).toBeVisible();
		await expect(projectSettings).toBeVisible();
		await expect(newProjectButton).toBeEnabled();
		await expect(goToProjectButton).toBeDisabled();

		let projectAlreadyExists = (await projectDropdown.innerText()).trim() === projectName;
		if (!projectAlreadyExists) {
			await projectDropdown.click();
			const searchField = page.locator('input[aria-label="Search"]');
			await expect(searchField).toBeVisible();
			await searchField.fill(projectName);

			const existingProjectRow = page.getByRole('row', { name: projectName, exact: true });
			projectAlreadyExists = await existingProjectRow.count() > 0;
			if (projectAlreadyExists) {
				await existingProjectRow.click();
			}
		}

		if (projectAlreadyExists) {
			// The header shows the current project; switch to it only when another project is current.
			if ((await projectApplicationTab.innerText()).trim() !== projectName) {
				await expect(goToProjectButton).toBeEnabled();
				await goToProjectButton.click();
				await expect(page).toHaveURL(/cases\/filters/, { timeout: 30000 });
			}
		} else {
			await projectDropdown.click();
			await expect(page.locator('input[aria-label="Search"]')).toBeHidden();
			await newProjectButton.click();

			const projectNameField = page.getByRole('textbox', { name: 'Project name' });
			const descriptionField = page.locator('textarea');
			const applicationNameField = page.getByRole('textbox', { name: 'Web application' });
			const applicationVersionField = page.getByRole('textbox', { name: 'Production' });
			const cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
			const createButton = page.getByRole('button', { name: 'Create', exact: true });

			await expect(page.getByText('New project', { exact: true })).toBeVisible();
			await expect(projectNameField).toBeVisible();
			await expect(descriptionField).toBeVisible();
			await expect(page.getByText('Application type*', { exact: true })).toBeVisible();
			await expect(page.getByText('Web application', { exact: true }).first()).toBeVisible();
			await expect(page.getByText('Engine version*', { exact: true })).toBeVisible();
			await expect(cancelButton).toBeEnabled();
			await expect(createButton).toBeDisabled();

			const multipleApplications = page.getByRole('checkbox', { name: 'Allow adding multiple applications in this project' });
			const multipleVersions = page.getByRole('checkbox', { name: 'Allow multiple versions for applications' });
			await multipleApplications.check();
			await expect(multipleApplications).toBeChecked();
			await expect(page.getByText(/add application/i)).toBeVisible();
			await multipleVersions.check();
			await expect(multipleVersions).toBeChecked();

			await projectNameField.fill(projectName);
			await descriptionField.fill('Project created by the Testsigma Playwright automation suite using the Modern engine.');
			await applicationNameField.fill('Web App');
			await applicationVersionField.fill('modern web');

			const modernEngine = page.getByRole('button').filter({ has: page.getByText('Modern', { exact: true }) });
			await expect(modernEngine).toBeVisible();
			await modernEngine.click();
			await expect(modernEngine).toHaveClass(/border-primary-1000/);

			await expect(projectNameField).toHaveValue(projectName);
			await expect(applicationNameField).toHaveValue('Web App');
			await expect(applicationVersionField).toHaveValue('modern web');
			await expect(cancelButton).toBeEnabled();
			await expect(createButton).toBeEnabled();
			await createButton.click();

			await expect(page.getByText(/project.*created|created.*successfully/i)).toBeVisible({ timeout: 30000 });
			await expect(page).toHaveURL(/cases\/filters/, { timeout: 60000 });
		}

		await page.reload();
		await page.mouse.move(20, 100);
		await expect(projectApplicationTab).toBeVisible({ timeout: 30000 });
		await projectApplicationTab.click();
		await expect(projectDropdown).toContainText(projectName);
		await projectDropdown.click();

		const searchField = page.locator('input[aria-label="Search"]');
		await expect(searchField).toBeVisible();
		await searchField.fill('');
		const otherProjectRow = page.getByRole('row').filter({ hasNotText: projectName }).first();
		await expect(otherProjectRow).toBeVisible();
		await otherProjectRow.click();
		// Choosing a project other than the current one enables navigating to it.
		await expect(goToProjectButton).toBeEnabled();

		await page.reload();
		await page.mouse.move(20, 100);
		await expect(projectApplicationTab).toBeVisible({ timeout: 30000 });
		await projectApplicationTab.click();
		await projectDropdown.click();
		await searchField.fill(projectName);
		const createdProjectRow = page.getByRole('row', { name: projectName, exact: true });
		await expect(createdProjectRow).toBeVisible();
		await createdProjectRow.click();
		await expect(projectDropdown).toContainText(projectName);
		await expect(applicationDropdown).toContainText('Web App');
		await expect(versionDropdown).toContainText('modern web');
		// The created project is already the current one, so there is nothing to navigate to.
		await expect(goToProjectButton).toBeDisabled();
	} catch (error) {
		throw new Error('TestSigma Modern project creation and selection scenario failed.', { cause: error });
	}
});
