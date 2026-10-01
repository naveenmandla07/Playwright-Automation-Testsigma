/**
 * Creating a web project on the Classic engine and selecting it from the project switcher.
 *
 * Scenario:
 * - Sign in and open the project switcher; check its Project, Application and Version dropdowns and buttons.
 * - Create "Testsigma_New_Project_1" (application "Web App", version "classic web", Classic engine), or switch to
 *   it when it already exists.
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
	name: 'Testsigma_New_Project_1',
	engine: 'Classic',
	application: 'Web App',
	version: 'classic web',
	description: 'Project created by the Testsigma Playwright automation suite.',
};

test('[Naveen] Testsigma_New_Project_1', async ({ page, projectSwitcher }) => {
	test.skip(missingCredentials, missingCredentialsMessage);

	try {
		await signInToTestsigma(page);
		await projectSwitcher.openAndCheck();
		await projectSwitcher.createOrSwitchTo(project);
		await projectSwitcher.checkSelectingProjects(project, { reloadBetween: true });
	} catch (error) {
		throw new Error('TestSigma project creation and selection scenario failed.', { cause: error });
	}
});
