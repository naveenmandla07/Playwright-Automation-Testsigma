/**
 * Generating test cases with Atto (Testsigma's AI) and saving one to the test case library.
 *
 * Scenario:
 * - Sign in, note how many test cases the "AI Generated Feature" library folder holds, and open Atto.
 * - Generate test cases from a prompt, reading the existing test case library, and wait for them to appear
 *   (AI generation can take up to two minutes).
 * - Check the All / Pending / Accepted / Rejected filters and open a generated test case: navigate between
 *   cases and review its manual steps.
 * - Generate automated steps for it and review the converted steps.
 * - Check the run options: Testsigma Lab, Local Devices (terminal offline, Launch disabled) and Copilot
 *   (unavailable).
 * - Save the test case to the "AI Generated Feature" folder and confirm it appears in the library.
 *
 * Adds one test case to the library on every run.
 */
import { expect, test, type Page } from '@playwright/test';
import { AttoHomePage } from '../pages/atto/AttoPlaygroundPage';
import { TestCaseLibraryPage } from '../pages/atto/TestCaseLibraryPage';
import { SideNavigation } from '../pages/components/SideNavigation';
import { missingCredentials, missingCredentialsMessage, signInToTestsigma } from '../support/testsigma-auth';

const generationPrompt = 'Generate test cases for a user login page with email and password fields. Cover successful login with valid credentials, invalid email format, incorrect password, empty fields, password visibility toggle, and forgot-password navigation. For each test case, provide a clear title, preconditions, steps, and expected results, including relevant validation and error messages.';
const targetFolderName = 'AI Generated Feature';

async function installNewsNotificationHandler(page: Page) {
	const notificationPrompt = page.getByText("We'd like to show you notifications for the latest news and updates.", { exact: true });
	const noThanksButton = page.getByRole('button', { name: /no,?\s*thanks/i });

	await page.addLocatorHandler(notificationPrompt, async () => {
		await expect(noThanksButton).toBeVisible();
		await noThanksButton.click();
		await expect(notificationPrompt).toBeHidden();
	});
}

test('[Atto] Generate, automate, inspect labs, and save a test case', async ({ page }) => {
	test.setTimeout(300000);
	test.skip(missingCredentials, missingCredentialsMessage);

	await installNewsNotificationHandler(page);
	await signInToTestsigma(page);

	const currentProjectId = await new SideNavigation(page).currentVersionId();
	expect(currentProjectId, 'The Test Suites link should identify the current project').toBeTruthy();

	const library = new TestCaseLibraryPage(page);
	let projectId = currentProjectId!;
	await library.open(projectId);
	if (!await library.folder(targetFolderName).count() && projectId !== '1') {
		projectId = '1';
		await library.open(projectId);
	}
	await expect(library.folder(targetFolderName), 'The selected project must contain the AI Generated Feature folder').toHaveCount(1);
	const initialLibraryCount = await library.folderCount(targetFolderName);

	const atto = new AttoHomePage(page);
	await atto.open(projectId);
	const playground = await atto.startGenerating();

	await expect(playground.promptField).toBeVisible();
	await expect(playground.readLibraryCheckbox).toBeVisible();
	await playground.stopReadingLibrary();

	await playground.promptField.fill(generationPrompt);
	await expect(playground.generateButton).toBeEnabled();
	await playground.generateButton.click();

	await expect(playground.promptField).toBeDisabled();
	await expect(playground.generatedCases).toBeVisible({ timeout: 120000 });
	await expect(playground.promptField).toBeEnabled({ timeout: 120000 });

	const playgroundUrl = page.url();
	for (const resultTab of playground.resultTabs) {
		await expect(resultTab).toBeVisible();
		await expect(resultTab).toBeEnabled();
		await resultTab.click();
		await expect(page).toHaveURL(playgroundUrl);
	}
	await playground.resultTabs[0].click();

	await expect(playground.firstGroupCount).toBeVisible();
	await playground.firstGroupCount.click();

	await expect(playground.firstTestCase).toBeVisible();
	await playground.firstTestCase.click();

	const modal = playground.modal;
	await expect(modal.heading).toBeVisible({ timeout: 15000 });
	await expect(modal.moveWith).toBeVisible();

	await expect(modal.previousButton).toBeVisible();
	await expect(modal.nextButton).toBeVisible();
	await expect(modal.nextButton).toBeEnabled();
	await expect(modal.closeButton).toBeVisible();

	await expect(modal.title).toBeVisible();
	const generatedTestCaseTitle = (await modal.title.innerText()).trim();
	expect(generatedTestCaseTitle).not.toBe('');
	await expect(modal.badge('New')).toBeVisible();
	await expect(modal.badge('Pending')).toBeVisible();

	await expect(modal.manualStepsTab).toBeVisible();
	await expect(modal.manualStepsTab).toBeEnabled();
	await expect(modal.automatedStepsTab).toBeVisible();
	await expect(modal.automatedStepsTab).toBeEnabled();

	await expect(modal.steps.first()).toBeVisible();
	expect(await modal.steps.count()).toBeGreaterThan(0);
	await expect(modal.editButton).toBeVisible();
	await expect(modal.generateAutomatedSteps).toBeVisible();
	await expect(modal.agenticLearning).toBeVisible();

	await modal.automatedStepsTab.click();
	await expect(modal.contextHint).toBeVisible();
	await expect(modal.generateAutomatedSteps).toBeEnabled();
	await modal.generateAutomatedSteps.click();

	await expect(modal.runWithCopilot).toBeEnabled({ timeout: 180000 });
	await expect(modal.agenticLearning).toBeVisible({ timeout: 180000 });
	await expect(modal.agenticLearning).toBeEnabled();
	await expect(modal.generateAutomatedSteps).toBeHidden({ timeout: 180000 });

	await expect(modal.steps.first()).toBeVisible();
	expect(await modal.steps.count(), 'Automated steps should be generated from the manual steps').toBeGreaterThan(0);

	await modal.runWithCopilot.click({ force: true });
	await expect(modal.testsigmaLab).toHaveCount(1, { timeout: 15000 });
	await expect(modal.localDevicesLab).toHaveCount(1, { timeout: 15000 });
	await modal.testsigmaLab.click({ force: true });
	await modal.localDevicesLab.click({ force: true });
	await expect(modal.copilotUnavailable).toHaveCount(1);
	expect(await modal.agentNotRunning.count()).toBeGreaterThan(0);
	await expect(modal.launchButton).toBeDisabled();
	await modal.cancelButton.click({ force: true });

	await modal.agenticLearning.click({ force: true });
	await expect(modal.terminalOffline).toHaveCount(1, { timeout: 15000 });
	await expect(modal.localDevicesLab).toHaveCount(1);
	await expect(modal.launchButton).toBeDisabled();
	await modal.cancelButton.click({ force: true });

	await expect(playground.saveToLibrary).toBeEnabled();
	await playground.saveToLibrary.click();
	await expect(playground.selectLocation).toBeVisible({ timeout: 15000 });
	await playground.locationSearch.fill(targetFolderName);
	const targetFolder = playground.locationFolder(targetFolderName);
	await expect(targetFolder).toBeVisible();
	await targetFolder.click();
	await expect(playground.targetFolderLabel).toBeVisible();
	await expect(playground.confirmLocation).toBeEnabled();
	await playground.confirmLocation.click();
	await expect(playground.confirmLocation).toHaveCount(0, { timeout: 30000 });

	// Confirm only selects the destination. Click Save again to persist the test case.
	const finalSaveButton = (await playground.saveButton.isVisible()) ? playground.saveButton : playground.saveToLibrary;
	await expect(finalSaveButton).toBeEnabled({ timeout: 15000 });
	await finalSaveButton.click();
	await expect(finalSaveButton).toBeDisabled({ timeout: 30000 });

	const libraryVerification = new TestCaseLibraryPage(await page.context().newPage());
	await libraryVerification.open(projectId);
	const updatedTargetFolder = libraryVerification.folder(targetFolderName);
	await expect(updatedTargetFolder).toHaveText(
		new RegExp(`^AI Generated Feature\\s*\\(${initialLibraryCount + 1}\\)$`),
		{ timeout: 30000 },
	);
	await updatedTargetFolder.click();
	await expect(libraryVerification.testCase(generatedTestCaseTitle)).toBeVisible({ timeout: 30000 });
	await libraryVerification.page.close();

	await page.bringToFront();
	await modal.closeButton.click();
	await expect(modal.heading).toBeHidden();
});
