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
import { signInToTestsigma } from '../support/testsigma-auth';

const email = process.env.TESTSIGMA_EMAIL;
const password = process.env.TESTSIGMA_PASSWORD;
const generationPrompt = 'Generate test cases for a user login page with email and password fields. Cover successful login with valid credentials, invalid email format, incorrect password, empty fields, password visibility toggle, and forgot-password navigation. For each test case, provide a clear title, preconditions, steps, and expected results, including relevant validation and error messages.';

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
	test.skip(!email || !password, 'Set TESTSIGMA_EMAIL and TESTSIGMA_PASSWORD in .env to run this test.');

	await installNewsNotificationHandler(page);
	await signInToTestsigma(page);

	const testSuitesHref = await page.getByRole('link', { name: 'Test Suites' }).getAttribute('href');
	const currentProjectId = testSuitesHref?.match(/\/td\/([^/]+)/)?.[1];
	expect(currentProjectId, 'The Test Suites link should identify the current project').toBeTruthy();

	let projectId = currentProjectId!;
	await page.goto(`/ui/td/${projectId}/cases/filters`);
	const libraryTree = page.getByRole('tree');
	await expect(libraryTree).toBeVisible({ timeout: 30000 });
	let initialTargetFolder = libraryTree.getByRole('button', { name: /^AI Generated Feature \(\d+\)$/ });
	if (!await initialTargetFolder.count() && projectId !== '1') {
		projectId = '1';
		await page.goto(`/ui/td/${projectId}/cases/filters`);
		await expect(libraryTree).toBeVisible({ timeout: 30000 });
		initialTargetFolder = libraryTree.getByRole('button', { name: /^AI Generated Feature \(\d+\)$/ });
	}
	await expect(initialTargetFolder, 'The selected project must contain the AI Generated Feature folder').toHaveCount(1);
	const countMatch = (await initialTargetFolder.innerText()).match(/\((\d+)\)$/);
	const initialLibraryCount = Number(countMatch?.[1] ?? 0);

	await page.goto(`/ui/ai-journey/${projectId}`);
	await expect(page).toHaveURL(new RegExp(`/ui/ai-journey/${projectId}`));

	const homeGenerateButton = page.getByRole('button', { name: /ai_journey\.generate\.with\.ai/i }).first();
	await expect(homeGenerateButton).toBeEnabled();
	await homeGenerateButton.click();
	await page.waitForURL(/\/ui\/playground\//, { timeout: 30000 });

	const promptField = page.getByRole('textbox', { name: 'Describe the feature or flow you want to test...' });
	const readLibraryCheckbox = page.getByRole('checkbox', { name: 'Read existing test case library' });
	await expect(promptField).toBeVisible();
	await expect(readLibraryCheckbox).toBeVisible();

	if (await readLibraryCheckbox.isChecked()) {
		await page.getByText('Read existing test case library', { exact: true }).click();
	}
	await expect(readLibraryCheckbox).not.toBeChecked();

	await promptField.fill(generationPrompt);
	const generateButton = page.getByRole('button', { name: /Generate with AI/ }).last();
	await expect(generateButton).toBeEnabled();
	await generateButton.click();

	await expect(promptField).toBeDisabled();
	await expect(page.getByRole('button', { name: /All test cases \([1-9]\d*\)/ })).toBeVisible({ timeout: 120000 });
	await expect(promptField).toBeEnabled({ timeout: 120000 });

	const playgroundUrl = page.url();
	const resultTabs = [
		page.getByRole('button', { name: /^All test cases \(\d+\)$/ }),
		page.getByRole('button', { name: /^Pending \(\d+\)$/ }),
		page.getByRole('button', { name: /^Accepted \(\d+\)$/ }),
		page.getByRole('button', { name: /^Rejected \(\d+\)$/ }),
	];
	for (const resultTab of resultTabs) {
		await expect(resultTab).toBeVisible();
		await expect(resultTab).toBeEnabled();
		await resultTab.click();
		await expect(page).toHaveURL(playgroundUrl);
	}
	await resultTabs[0].click();

	const firstGroupCount = page.getByText(/^\(\d+\)$/).first();
	await expect(firstGroupCount).toBeVisible();
	await firstGroupCount.click();

	const firstTestCase = page.getByRole('button', { name: /New.*Pending/ }).first();
	await expect(firstTestCase).toBeVisible();
	await firstTestCase.click();

	const detailsHeading = page.getByRole('heading', { name: 'Test Case Details', exact: true }).filter({ visible: true });
	await expect(detailsHeading).toBeVisible({ timeout: 15000 });
	await expect(page.getByText('Move with', { exact: true }).filter({ visible: true })).toBeVisible();

	const previousCaseButton = page.getByRole('button', { name: 'Navigate to previous test case', exact: true }).filter({ visible: true });
	const nextCaseButton = page.getByRole('button', { name: 'Navigate to next test case', exact: true }).filter({ visible: true });
	const closeModalButton = page.getByRole('button', { name: 'Close modal', exact: true }).filter({ visible: true });
	await expect(previousCaseButton).toBeVisible();
	await expect(nextCaseButton).toBeVisible();
	await expect(nextCaseButton).toBeEnabled();
	await expect(closeModalButton).toBeVisible();

	const generatedTitleHeading = page.getByRole('heading', { level: 1 }).filter({ visible: true });
	await expect(generatedTitleHeading).toBeVisible();
	const generatedTestCaseTitle = (await generatedTitleHeading.innerText()).trim();
	expect(generatedTestCaseTitle).not.toBe('');
	const detailsBadges = page.locator('span.px-2').filter({ visible: true });
	await expect(detailsBadges.filter({ hasText: /^New$/ })).toBeVisible();
	await expect(detailsBadges.filter({ hasText: /^Pending$/ })).toBeVisible();

	const manualStepsTab = page.getByRole('button', { name: 'Manual Steps', exact: true }).filter({ visible: true });
	const automatedStepsTab = page.getByRole('button', { name: 'Automated Steps', exact: true }).filter({ visible: true });
	await expect(manualStepsTab).toBeVisible();
	await expect(manualStepsTab).toBeEnabled();
	await expect(automatedStepsTab).toBeVisible();
	await expect(automatedStepsTab).toBeEnabled();

	const manualSteps = page.getByText(/^(Navigate|Wait|Enter|Click|Verify|Open|Select|Submit|Type)\b/i).filter({ visible: true });
	await expect(manualSteps.first()).toBeVisible();
	expect(await manualSteps.count()).toBeGreaterThan(0);
	await expect(page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true })).toBeVisible();
	await expect(page.getByRole('button', { name: /Generate Automated Steps$/ }).filter({ visible: true })).toBeVisible();
	await expect(page.getByText('Agentic Learning', { exact: true }).filter({ visible: true })).toBeVisible();

	await automatedStepsTab.click();
	await expect(page.getByText(/Leverage provided context to create steps/i).filter({ visible: true })).toBeVisible();
	const generateAutomatedSteps = page.getByRole('button', { name: /Generate Automated Steps$/ }).filter({ visible: true });
	await expect(generateAutomatedSteps).toBeEnabled();
	await generateAutomatedSteps.click();

	const runWithCopilot = page.getByRole('button', { name: /Run with Copilot$/ }).filter({ visible: true });
	const agenticLearning = page.getByText('Agentic Learning', { exact: true }).filter({ visible: true });
	await expect(runWithCopilot).toBeEnabled({ timeout: 180000 });
	await expect(agenticLearning).toBeVisible({ timeout: 180000 });
	await expect(agenticLearning).toBeEnabled();
	await expect(generateAutomatedSteps).toBeHidden({ timeout: 180000 });

	const convertedSteps = page.getByText(/^(Navigate|Wait|Enter|Click|Verify|Open|Select|Submit|Type)\b/i).filter({ visible: true });
	await expect(convertedSteps.first()).toBeVisible();
	expect(await convertedSteps.count(), 'Automated steps should be generated from the manual steps').toBeGreaterThan(0);

	await runWithCopilot.click({ force: true });
	const testsigmaLab = page.getByRole('button', { name: /Testsigma Lab$/, includeHidden: true });
	const localDevicesLab = page.getByRole('button', { name: /Local Devices$/, includeHidden: true });
	await expect(testsigmaLab).toHaveCount(1, { timeout: 15000 });
	await expect(localDevicesLab).toHaveCount(1, { timeout: 15000 });
	await testsigmaLab.click({ force: true });
	await localDevicesLab.click({ force: true });
	await expect(page.getByText(/Copilot is unavailable/)).toHaveCount(1);
	expect(await page.getByText(/Not Installed|Not Started/).count()).toBeGreaterThan(0);
	const copilotLaunch = page.getByRole('button', { name: 'Launch', exact: true, includeHidden: true });
	await expect(copilotLaunch).toBeDisabled();
	await page.getByRole('button', { name: 'Cancel', exact: true, includeHidden: true }).click({ force: true });

	await agenticLearning.click({ force: true });
	await expect(page.getByText('Terminal is offline', { exact: true })).toHaveCount(1, { timeout: 15000 });
	await expect(page.getByRole('button', { name: /Local Devices$/, includeHidden: true })).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Launch', exact: true, includeHidden: true })).toBeDisabled();
	await page.getByRole('button', { name: 'Cancel', exact: true, includeHidden: true }).click({ force: true });

	const saveToLibrary = page.getByRole('button', { name: 'Save to Library', exact: true }).filter({ visible: true });
	await expect(saveToLibrary).toBeEnabled();
	await saveToLibrary.click();
	await expect(page.getByText('Select Location', { exact: true }).filter({ visible: true })).toBeVisible({ timeout: 15000 });
	const locationSearch = page.getByRole('textbox', { name: 'Search', exact: true }).filter({ visible: true });
	await locationSearch.fill('AI Generated Feature');
	const targetFolder = page.getByRole('button', { name: 'AI Generated Feature', exact: true }).filter({ visible: true });
	await expect(targetFolder).toBeVisible();
	await targetFolder.click();
	await expect(page.getByText('Target Folder', { exact: true }).filter({ visible: true })).toBeVisible();
	const confirmLocation = page.getByRole('button', { name: 'Confirm', exact: true }).filter({ visible: true });
	await expect(confirmLocation).toBeEnabled();
	await confirmLocation.click();
	await expect(confirmLocation).toHaveCount(0, { timeout: 30000 });

	// Confirm only selects the destination. Click Save again to persist the test case.
	const save = page.getByRole('button', { name: 'Save', exact: true }).filter({ visible: true });
	const finalSaveButton = (await save.isVisible()) ? save : saveToLibrary;
	await expect(finalSaveButton).toBeEnabled({ timeout: 15000 });
	await finalSaveButton.click();
	await expect(finalSaveButton).toBeDisabled({ timeout: 30000 });

	const libraryVerificationPage = await page.context().newPage();
	await libraryVerificationPage.goto(`/ui/td/${projectId}/cases/filters`);
	const verificationTree = libraryVerificationPage.getByRole('tree');
	await expect(verificationTree).toBeVisible({ timeout: 30000 });
	const updatedTargetFolder = verificationTree.getByRole('button', { name: /^AI Generated Feature \(\d+\)$/ });
	await expect(updatedTargetFolder).toHaveText(
		new RegExp(`^AI Generated Feature\\s*\\(${initialLibraryCount + 1}\\)$`),
		{ timeout: 30000 },
	);
	await updatedTargetFolder.click();
	const savedTestCase = verificationTree.getByRole('link').filter({ hasText: generatedTestCaseTitle }).last();
	await expect(savedTestCase).toBeVisible({ timeout: 30000 });
	await libraryVerificationPage.close();

	await page.bringToFront();
	await closeModalButton.click();
	await expect(detailsHeading).toBeHidden();
});
