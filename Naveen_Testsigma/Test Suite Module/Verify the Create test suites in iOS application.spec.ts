/**
 * Creating test suites for the iOS application of the "[9.0.8] Accessibility" project.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Switch to the "[9.0.8] Accessibility" project, its "iOS App" application and version "1".
 * - Open the Test Suites module and check its page.
 * - Check the Create Test Suite form and the Add/Remove Test Cases picker.
 * - Create "All test cases included in Tests Suite 1" with every test case of the version.
 * - Create "Selected random cases in Test Suite 2" with 4 or 5 test cases picked at random.
 *
 * Needs at least 5 ready, automated test cases in the iOS application's version "1".
 *
 * The two suites are kept after the run so they can be reviewed; a run first deletes suites left with the same
 * names by an earlier run. Runs in the serial chromium-projects project because it changes the account's
 * current project.
 */
import { test, type Page } from '@playwright/test';
import {
	createSuiteWithAllCases,
	createSuiteWithRandomCases,
	suiteNames,
	verifyCreateFormAndPicker,
	verifyTestSuitesPage,
} from '../support/create-test-suites';
import { openSignedInPage, projectName, switchToApplication, versionName, type SuiteApplication } from '../support/accessibility-project';
import { missingCredentials, missingCredentialsMessage } from '../support/testsigma-auth';

const application: SuiteApplication = { name: 'iOS App', type: 'IOSNative' };

test.describe('Verify the Create test suites in iOS application', () => {
	test.describe.configure({ mode: 'serial', timeout: 180000 });
	test.skip(missingCredentials, missingCredentialsMessage);

	let page: Page;
	let versionId: number;

	test.beforeAll(async ({ browser }) => {
		({ page, versionId } = await openSignedInPage(browser, application));
	});

	test.afterAll(async () => {
		await page.close();
	});

	test(`Switch to the ${projectName} project, ${application.name} and version ${versionName}`, async () => {
		await switchToApplication(page, application, versionId);
	});

	test('Verify the Test Suites page', async () => {
		await verifyTestSuitesPage(page, versionId);
	});

	test('Verify the Create Test Suite form and the test case picker', async () => {
		await verifyCreateFormAndPicker(page, application, versionId);
	});

	test(`Create "${suiteNames.allCases}" with every test case`, async () => {
		await createSuiteWithAllCases(page, versionId);
	});

	test(`Create "${suiteNames.randomCases}" with 4 or 5 random test cases`, async () => {
		await createSuiteWithRandomCases(page, application, versionId);
	});
});
