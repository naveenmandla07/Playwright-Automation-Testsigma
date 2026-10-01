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
import { test } from '../pages/fixtures';
import type { NewProject } from '../pages/projects/NewProjectForm';
import { missingCredentials, missingCredentialsMessage, signInToTestsigma } from '../support/testsigma-auth';

const project: NewProject = {
	name: 'Testsigma_New_Project_1_Modern',
	engine: 'Modern',
	application: 'Web App',
	version: 'modern web',
	description: 'Project created by the Testsigma Playwright automation suite using the Modern engine.',
};

test('[Modern] Verify Testsigma_New_Project_1_Modern creation and selection', async ({ page, projectSwitcher }) => {
	test.skip(missingCredentials, missingCredentialsMessage);

	try {
		await signInToTestsigma(page);
		await projectSwitcher.openAndCheck();
		await projectSwitcher.createOrSwitchTo(project);
		await projectSwitcher.checkSelectingProjects(project, { reloadBetween: true });
	} catch (error) {
		throw new Error('TestSigma Modern project creation and selection scenario failed.', { cause: error });
	}
});
