/**
 * Creating a cross browser test plan for the Salesforce application of the "[9.0.8] Accessibility" project.
 *
 * Scenarios (run in order, sharing one signed-in page and one Create Test Plan wizard):
 * - Switch to the "[9.0.8] Accessibility" project, its "Salesforce" application and version "1".
 * - Open the Test Plans module and check its page.
 * - Basic Details: check the step, choose "Cross browser testing" and enter the name, description and labels.
 * - Add Test Suites: add "All test cases included in Tests Suite 1", created by the Salesforce test suite spec.
 * - Link Machine Profiles: link the pre-defined "Windows Chrome" profile and a new user-defined profile.
 * - Test Plan Settings: turn on notifications for passed and failed runs, sent to naveen.mandla@testsigma.com.
 * - Create the test plan and check what was saved.
 *
 * Needs the suite from "Verify the Create test suites in Salesforce application.spec.ts". The plan is kept
 * after the run so it can be reviewed; a run first deletes a plan left with the same name by an earlier run.
 * Runs in the serial chromium-projects project because it changes the account's current project.
 */
import { test } from '@playwright/test';
import {
	addTestSuites,
	createPlan,
	fillBasicDetails,
	fillPlanSettings,
	linkMachineProfiles,
	verifyTestPlansPage,
	type PlanRun,
	type PlanScenario,
} from '../../support/create-test-plans';
import { openSignedInPage, projectName, suiteNames, switchToApplication, versionName } from '../../support/create-test-suites';

const plan: PlanScenario = {
	application: { name: 'Salesforce', type: 'Salesforce' },
	suiteSpec: 'Verify the Create test suites in Salesforce application.spec.ts',
	name: 'Cross browser test plan for Salesforce',
	description: 'Cross browser test plan created by the Testsigma Playwright automation suite.',
	labels: ['cross-browser', 'salesforce'],
	suites: [suiteNames.allCases],
	// Salesforce offers a single ready-made profile.
	predefinedCatalog: ['Windows Chrome'],
	predefinedMachines: ['Windows Chrome'],
	userDefinedMachines: [{ name: 'User-defined Salesforce Machine' }],
	machineForm: {
		labels: ['Test Lab', 'Test Machine', 'OS & Version', 'Browser', 'Resolution', 'Parallel Settings'],
		checked: ['Reset session for every test case'],
		unchecked: ['Headless Test', 'Run test cases inside test suite in parallel'],
	},
	notifyOn: ['Passed', 'Failed'],
	notificationEmail: 'naveen.mandla@testsigma.com',
	extraSettings: ['Salesforce Metadata connection'],
};

test.describe('Verify the Create test plan in Salesforce application', () => {
	test.describe.configure({ mode: 'serial', timeout: 240000 });
	test.skip(!process.env.TESTSIGMA_EMAIL || !process.env.TESTSIGMA_PASSWORD, 'Set TESTSIGMA_EMAIL and TESTSIGMA_PASSWORD in .env to run this test.');

	let run: PlanRun;

	test.beforeAll(async ({ browser }) => {
		const { page, versionId } = await openSignedInPage(browser, plan.application);
		run = { page, versionId, suiteIds: new Map(), planId: 0 };
	});

	test.afterAll(async () => {
		await run.page.close();
	});

	test(`Switch to the ${projectName} project, ${plan.application.name} and version ${versionName}`, async () => {
		await switchToApplication(run.page, plan.application, run.versionId);
	});

	test('Verify the Test Plans page', async () => {
		await verifyTestPlansPage(run, plan);
	});

	test('Basic Details: choose Cross browser testing and enter the name, description and labels', async () => {
		await fillBasicDetails(run, plan);
	});

	test('Add Test Suites: add the Salesforce test suite', async () => {
		await addTestSuites(run, plan);
	});

	test('Link Machine Profiles: one pre-defined and one user-defined test machine', async () => {
		await linkMachineProfiles(run, plan);
	});

	test(`Test Plan Settings: send notifications to ${plan.notificationEmail}`, async () => {
		await fillPlanSettings(run, plan);
	});

	test('Create the test plan', async () => {
		await createPlan(run, plan);
	});
});
