/**
 * Creating a cross browser test plan for the iOS application of the "[9.0.8] Accessibility" project.
 *
 * Scenarios (run in order, sharing one signed-in page and one Create Test Plan wizard):
 * - Switch to the "[9.0.8] Accessibility" project, its "iOS App" application and version "1".
 * - Open the Test Plans module and check its page.
 * - Basic Details: check the step, that a plan cannot be created without a name, choose "Cross browser testing",
 *   enter the name, description and labels, add and remove a label with "+ Add" and stay after Cancel.
 * - Add Test Suites: add "All test cases included in Tests Suite 1", created by the iOS test suite spec.
 *   Along the way cancel the picker, search it, open each of its filters, filter by last run result, move
 *   suites with Select All, Select and Remove, search the plan's suites and remove a suite and add it back.
 * - Link Machine Profiles: iOS has no pre-defined profiles, so create two user-defined ones, the second on a
 *   different device from the first.
 *   Cancel the Add Machine form once, check its lab switch and fields, and change the first profile's settings.
 * - Test Plan Settings: turn on notifications for passed and failed runs, sent to naveen.mandla@testsigma.com and
 *   the signed-in account, refuse an invalid address, choose an environment and failed-step screenshots, refuse
 *   timeouts over 120 seconds and set valid ones, turn on accessibility testing, change every recovery action and
 *   check the post plan hook.
 * - Create the test plan and check what was saved.
 * - Find the plan in the Test Plans list by searching for it, and check the list's filters and sort options.
 *
 * Needs the suite from "Verify the Create test suites in iOS application.spec.ts". The plan is kept after
 * the run so it can be reviewed; a run first deletes a plan left with the same name by an earlier run. Runs in
 * the serial chromium-projects project because it changes the account's current project.
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
import { openSignedInPage, projectName, switchToApplication, versionName } from '../../support/accessibility-project';
import { suiteNames } from '../../support/create-test-suites';
import { missingCredentials, missingCredentialsMessage } from '../../support/testsigma-auth';

const plan: PlanScenario = {
	application: { name: 'iOS App', type: 'IOSNative' },
	suiteSpec: 'Verify the Create test suites in iOS application.spec.ts',
	name: 'Cross browser test plan for iOS',
	description: 'Cross browser test plan created by the Testsigma Playwright automation suite.',
	labels: ['cross-browser', 'ios'],
	suites: [suiteNames.allCases],
	predefinedCatalog: [],
	predefinedMachines: [],
	userDefinedMachines: [{ name: 'User-defined iOS Device 1' }, { name: 'User-defined iOS Device 2', otherDevice: true }],
	machineForm: {
		labels: ['Test Lab', 'Test Machine', 'OS & Version', 'Device', 'App Source', 'Uploads', 'Parallel Settings', 'Select backup devices', 'Pre-requisites'],
		checked: ['Reset session for every test case'],
		unchecked: ['Run test cases inside test suite in parallel', 'Reset session for every iterations in data driven test case', 'Camera image injection', 'Network logs'],
	},
	machineChoices: {
		turnOn: ['Network logs'],
		saved: { isNetworkLogsEnabled: true },
	},
	notifyOn: ['Passed', 'Failed'],
	notificationEmail: 'naveen.mandla@testsigma.com',
};

test.describe('Verify the Create test plan in iOS application', () => {
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

	test('Add Test Suites: add the iOS test suite', async () => {
		await addTestSuites(run, plan);
	});

	test('Link Machine Profiles: two user-defined test machines', async () => {
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
