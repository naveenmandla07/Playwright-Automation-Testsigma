/**
 * Creating a cross browser test plan for the Salesforce application of the "[9.0.8] Accessibility" project.
 *
 * Scenarios (run in order, sharing one signed-in page and one Create Test Plan wizard):
 * - Switch to the "[9.0.8] Accessibility" project, its "Salesforce" application and version "1".
 * - Open the Test Plans module and check its page.
 * - Basic Details: check the step, that a plan cannot be created without a name, choose "Cross browser testing",
 *   enter the name, description and labels, add and remove a label with "+ Add" and stay after Cancel.
 * - Add Test Suites: add "All test cases included in Tests Suite 1", created by the Salesforce test suite spec.
 *   Along the way cancel the picker, search it, open each of its filters, filter by last run result, move
 *   suites with Select All, Select and Remove, search the plan's suites and remove a suite and add it back.
 * - Link Machine Profiles: link the pre-defined "Windows Chrome" profile and a new user-defined profile.
 *   Cancel the Add Machine form once, check its lab switch and fields, and change the first profile's settings.
 * - Test Plan Settings: turn on notifications for passed and failed runs, sent to naveen.mandla@testsigma.com and
 *   the signed-in account, refuse an invalid address, choose an environment and failed-step screenshots, refuse
 *   timeouts over 120 seconds and set valid ones, turn on accessibility testing, change every recovery action and
 *   check the post plan hook.
 * - Create the test plan and check what was saved.
 * - Find the plan in the Test Plans list by searching for it, and check the list's filters and sort options.
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
	verifyPlanInList,
	verifyTestPlansPage,
	type PlanRun,
	type PlanScenario,
} from '../../support/create-test-plans';
import { openSignedInPage, projectName, suiteNames, switchToApplication, versionName } from '../../support/create-test-suites';
import { missingCredentials, missingCredentialsMessage } from '../../support/testsigma-auth';

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
	machineChoices: {
		os: 'Windows 10',
		resolution: '1366x768',
		turnOn: ['Headless Test'],
		saved: { platformOsVersionId: 'windows-10', platformScreenResolutionId: '1366x768', isHeadless: true },
	},
	notifyOn: ['Passed', 'Failed'],
	notificationEmail: 'naveen.mandla@testsigma.com',
	extraSettings: ['Salesforce Metadata connection'],
};

test.describe('Verify the Create test plan in Salesforce application', () => {
	test.describe.configure({ mode: 'serial', timeout: 240000 });
	test.skip(missingCredentials, missingCredentialsMessage);

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

	test('Find the plan in the Test Plans list', async () => {
		await verifyPlanInList(run, plan);
	});
});
