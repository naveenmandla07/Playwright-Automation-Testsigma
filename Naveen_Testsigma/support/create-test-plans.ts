/**
 * Steps shared by the "Create test plan" specs under Test Plan Module. Each application of the
 * "[9.0.8] Accessibility" project has its own spec, which declares the tests, describes its plan as a
 * PlanScenario and runs these steps for it on the Test Plans page objects.
 */
import { expect, test, type Page, type Request } from '@playwright/test';
import { choose, closeDropdown, openDropdown } from '../pages/components/FormControls';
import { AddTestSuitesPicker } from '../pages/test-plans/AddTestSuitesPicker';
import { AddMachineForm, MachineProfilesDrawer } from '../pages/test-plans/MachineProfilesDrawer';
import { isPlanCreate, TestPlansApi } from '../pages/test-plans/TestPlansApi';
import { TestPlanDetailsPage, TestPlansPage } from '../pages/test-plans/TestPlansPage';
import { CreateTestPlanWizard } from '../pages/test-plans/CreateTestPlanWizard';
import { TestSuitesApi } from '../pages/test-suites/TestSuitesApi';
import type { SuiteApplication } from './accessibility-project';
import { accountEmail } from './testsigma-auth';
import { noResults } from './common';

// A user-defined machine profile; otherDevice puts it on a device no earlier profile of the plan uses.
export type UserDefinedMachine = { name: string; otherDevice?: boolean };

// What the first user-defined profile changes from the Add Machine form's defaults, and what the saved profile
// must then hold.
export type MachineChoices = {
	// An OS version picked from the OS & Version menu, e.g. "Windows 10".
	os?: string;
	resolution?: string;
	turnOn: string[];
	saved: Record<string, unknown>;
};

export type PlanScenario = {
	application: SuiteApplication;
	// The spec that creates the suites this plan needs, named in the message shown when they are missing.
	suiteSpec: string;
	name: string;
	description: string;
	labels: string[];
	suites: string[];
	// Every pre-defined profile the drawer lists; empty when the application has none.
	predefinedCatalog: string[];
	predefinedMachines: string[];
	userDefinedMachines: UserDefinedMachine[];
	// The Add Machine form's field labels and which of its checkboxes start checked or unchecked.
	machineForm: { labels: string[]; checked: string[]; unchecked: string[] };
	machineChoices: MachineChoices;
	notifyOn: string[];
	notificationEmail: string;
	// Settings fields only this application's plans have, e.g. a Salesforce connection.
	extraSettings?: string[];
};

// What one run of the scenario learns along the way.
// environment is the one chosen in the settings, when the project has any.
export type PlanRun = { page: Page; versionId: number; suiteIds: Map<string, number>; planId: number; environment?: string };

const testLabs = ['Testsigma Lab', 'Local Devices', 'Lambda Test', 'Sauce Labs', 'BrowserStack'];
const notificationStatuses = ['Passed', 'Failed', 'Not Executed', 'Queued', 'Stopped', 'Running'];

// A label added and then removed again, so it must not be saved with the plan.
const discardedLabel = 'discarded-label';
const invalidEmail = 'not-an-email';
const cancelledMachine = 'Cancelled machine profile';

// The Add Test Suites picker's filters and, where they are fixed, the options each offers.
const suiteFilters = ['Test Case', 'Last Run Result', 'Created By', 'Created Date', 'Updated Date', 'Last Run Date', 'Labels', 'Linked To'];
const lastRunResults = ['SUCCESS', 'FAILURE', 'ABORTED', 'NOT_EXECUTED', 'PRE_REQUISITE_FAILURE', 'QUEUED', 'STOPPED', 'PAUSED', 'SKIPPED', 'RUNNING'];
const dateFilters = ['Created Date', 'Updated Date', 'Last Run Date'];

const sortOptions = ['Name', 'Created Date', 'Updated Date', 'A to Z', 'Z to A'];
const screenshotOptions = ['For all steps', 'Only for failed Steps', 'No screenshot required', 'Use step level settings'];
const timeouts = { page: '60', step: '45', tooLong: '150' };

// Each recovery action with its two choices; the plan takes the second choice of each instead of the default.
const recoveryActions = [
	{ when: 'On Major Step Failure', choices: ['Abort and run next Test Case', 'Report and continue to next Test Step'] },
	{ when: 'On Test Step Pre-Requisite Failure', choices: ['Abort and run next Test Case', 'Report and continue to next Test Step'] },
	{ when: 'On Test Case Pre-Requisite Failure', choices: ['Abort Dependent Test Cases', 'Report and continue to next Test Case'] },
	{ when: 'On Test Suite Pre-Requisite Failure', choices: ['Abort Dependent Test Suites', 'Report and continue to next Test Suite'] },
	{ when: 'On Test Machine Pre-Requisite Failure', choices: ['Abort Dependent Test Machines', 'Report and continue to next Test Machine'] },
];
const rerunChoices = ['None', 'All Test Cases', 'Only Failed Test Cases'];

// The settings the plan is saved with once those choices are made.
const savedSettings = {
	pageTimeOut: Number(timeouts.page),
	stepTimeOut: Number(timeouts.step),
	enforceTimeOut: true,
	screenshot: 'FAILED_STEPS',
	recoveryAction: 'Run_Next_Step',
	onStepPreRequisiteFail: 'Run_Next_Step',
	onSuitePreRequisiteFail: 'Continue',
	onMachinePreRequisiteFail: 'Continue',
	reRunType: 'ONLY_FAILED_TESTS',
	isAccessibilityTestEnabled: true,
};

// Runs one part of the scenario and, when it fails, attaches a screenshot and names the part that failed.
async function step(page: Page, name: string, body: () => Promise<void>) {
	await test.step(name, async () => {
		try {
			await body();
		} catch (error) {
			await test.info().attach(`${name} - failure`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' }).catch(() => {});
			throw new Error(`Test plan step failed: ${name}`, { cause: error });
		}
	});
}

function allMachines(plan: PlanScenario) {
	return [...plan.predefinedMachines, ...plan.userDefinedMachines.map((machine) => machine.name)];
}

function currentMonth() {
	return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export async function verifyTestPlansPage(run: PlanRun, plan: PlanScenario) {
	const { page, versionId } = run;
	const api = new TestPlansApi(page, versionId);
	const plansPage = new TestPlansPage(page, versionId);

	await step(page, 'Check the suites the plan needs', async () => {
		run.suiteIds = new Map((await new TestSuitesApi(page, versionId).list()).map((suite) => [suite.name, suite.id]));
		for (const suite of plan.suites) {
			expect(run.suiteIds.has(suite), `Suite "${suite}" is missing; run "${plan.suiteSpec}" first`).toBe(true);
		}
	});

	await step(page, 'Remove a plan left by an earlier run', async () => {
		await api.deleteNamed(plan.name);
	});

	await step(page, 'Open Test Plans', async () => {
		await plansPage.openFromNavigation();
		await expect(plansPage.plansTab).toBeVisible({ timeout: 30000 });
		await expect(plansPage.schedulesTab).toHaveAttribute('href', `/ui/td/${versionId}/plans/schedules`);
		await expect(plansPage.refreshButton).toBeEnabled();
		await expect(plansPage.createButton).toBeEnabled();
		// The page shows either an empty state or the existing plans.
		const plans = await api.list();
		if (plans.length === 0) {
			await expect(plansPage.text('There are no Test Plan created.')).toBeVisible();
			await expect(plansPage.main.getByRole('img', { name: 'Empty state illustration' })).toBeVisible();
		} else {
			await expect(plansPage.text(plans[0].name).first()).toBeVisible();
		}
	});
}

export async function fillBasicDetails(run: PlanRun, plan: PlanScenario) {
	const { page, versionId } = run;
	const plansPage = new TestPlansPage(page, versionId);
	const wizard = new CreateTestPlanWizard(page, versionId);

	await step(page, 'Open the Create Test Plan wizard', async () => {
		await plansPage.startCreating();
		await expect(plansPage.main.getByRole('button', { name: 'Create Test Plan' })).toHaveCount(0);
		await expect(wizard.text('Create Test Plan')).toBeVisible();
		await expect(wizard.cancelButton).toBeEnabled();
		await expect(wizard.continueButton).toBeEnabled();
		await wizard.expectSteps();
	});

	await step(page, 'Check the Basic Details fields', async () => {
		await expect(wizard.nameField).toBeEmpty();
		await expect(wizard.nameField).toHaveAttribute('placeholder', 'Enter Name');
		await expect(wizard.descriptionToggle).not.toBeChecked();
		await expect(wizard.labelsField).toBeEmpty();
		await expect(wizard.text('Test Plan Type')).toBeVisible();
		await expect(wizard.text('Use single/multiple browsers to test all test suites')).toBeVisible();
		await expect(wizard.text('Manually add test machine profiles to individual test suites')).toBeVisible();
	});

	await step(page, 'A plan cannot be created without a name', async () => {
		// The wizard lets every step be passed without a name and only checks it on Create, which sends the
		// user back to Basic Details instead of saving the plan.
		const creates: string[] = [];
		const recordCreate = (request: Request) => {
			if (isPlanCreate(request)) {
				creates.push(request.url());
			}
		};
		page.on('request', recordCreate);
		try {
			await wizard.continueButton.click();
			await expect(wizard.suitesHeading(0)).toBeVisible({ timeout: 30000 });
			await wizard.continueButton.click();
			await expect(wizard.sendNotification).toBeAttached({ timeout: 30000 });
			await wizard.createButton.click();
			await expect(wizard.nameRequired).toBeVisible({ timeout: 30000 });
			await expect(wizard.nameField).toBeEmpty();
			await expect(wizard.continueButton).toBeVisible();
		} finally {
			page.off('request', recordCreate);
		}
		expect(creates, 'plans created without a name').toEqual([]);
		expect((await new TestPlansApi(page, versionId).list()).some((item) => !item.name)).toBe(false);
	});

	await step(page, 'Choose the Cross browser testing plan type', async () => {
		// Cross browser testing is the default; switch away and back to check the choice sticks.
		await expect(wizard.crossBrowserType).toBeChecked();
		await wizard.text('Custom test plan').click();
		await expect(wizard.customType).toBeChecked();
		await expect(wizard.crossBrowserType).not.toBeChecked();
		await wizard.text('Cross browser testing').click();
		await expect(wizard.crossBrowserType).toBeChecked();
		await expect(wizard.customType).not.toBeChecked();
	});

	await step(page, 'Enter the name and description', async () => {
		await wizard.enterNameAndDescription(plan.name, plan.description);
		await expect(wizard.nameRequired).toBeHidden();
	});

	await step(page, 'Add the labels', async () => {
		await wizard.addMissingLabels(plan.labels);
	});

	await step(page, 'Add a label with "+ Add" and remove it again', async () => {
		// "+ Add" is offered in the suggestions, which open when the box is clicked and follow the label as it is
		// typed; filling the box in one go does not update them.
		await page.keyboard.press('Escape');
		await wizard.labelsField.click();
		await wizard.labelsField.pressSequentially(discardedLabel);
		await wizard.main.getByRole('button', { name: '+ Add' }).click();
		await expect(wizard.labelsField).toBeEmpty();
		await expect(wizard.labelChip(discardedLabel)).toBeVisible();
		// The first click anywhere only closes the suggestions, so close them before removing the chip.
		await wizard.text('Test Plan Type').click();
		await wizard.removeLabelButton(discardedLabel).click();
		await expect(wizard.labelChip(discardedLabel)).toHaveCount(0);
		// The plan's own labels are not checked here: the form can drop them as it re-renders, and the step that
		// leaves Basic Details checks them and puts back any that were lost.
	});

	await step(page, 'Cancel asks before leaving the wizard', async () => {
		await wizard.cancelButton.click();
		const confirm = wizard.leaveDialog;
		await expect(confirm.getByText('You will lose all your progress and all changes will be discarded.')).toBeVisible();
		await expect(confirm.getByRole('button', { name: 'Leave', exact: true })).toBeEnabled();
		// Staying keeps everything entered so far.
		await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(confirm).toBeHidden();
		await expect(page).toHaveURL(new RegExp(`/td/${versionId}/plans/new$`));
		await expect(wizard.nameField).toHaveValue(plan.name);
	});

	await step(page, 'Continue to Add Test Suites', async () => {
		// Everything entered must still be in place before leaving the step; put back anything that was lost.
		await expect(async () => {
			await wizard.enterNameAndDescription(plan.name, plan.description);
			await wizard.addMissingLabels(plan.labels);
			await expect(wizard.nameField).toHaveValue(plan.name, { timeout: 2000 });
			await expect(wizard.descriptionField).toHaveValue(plan.description, { timeout: 2000 });
			for (const label of plan.labels) {
				await expect(wizard.labelChip(label)).toBeVisible({ timeout: 2000 });
			}
		}).toPass({ timeout: 45000 });
		await wizard.commitDescription(plan.description);
		await wizard.continueButton.click();
		await expect(wizard.main.getByText(/^Test Suites \(0\)/).first()).toBeVisible({ timeout: 30000 });
	});
}

export async function addTestSuites(run: PlanRun, plan: PlanScenario) {
	const { page } = run;
	const wizard = new CreateTestPlanWizard(page, run.versionId);
	const picker = new AddTestSuitesPicker(page);
	// Every suite of the version is offered; the plan keeps only its own.
	const allSuites = [...run.suiteIds.keys()];
	const extraSuites = allSuites.filter((suite) => !plan.suites.includes(suite));
	const readdedSuite = plan.suites[plan.suites.length - 1];
	const removedSuites = [...extraSuites, readdedSuite];

	await step(page, 'Check the empty suites list', async () => {
		await expect(wizard.text('No Test Suite has been added to this plan')).toBeVisible();
		await expect(wizard.main.getByRole('img', { name: 'No test suites added illustration' })).toBeVisible();
		await expect(wizard.main.getByRole('button', { name: 'Add Test Suites' })).toBeEnabled();
	});

	await step(page, 'Cancelling the picker adds nothing', async () => {
		await wizard.openSuitePicker(allSuites.length);
		await picker.tick(plan.suites[0]);
		await picker.button('Select').click();
		await picker.expectCounts(allSuites.length - 1, 1);
		await picker.cancel();
		await expect(wizard.suitesHeading(0)).toBeVisible();
		await expect(wizard.text('No Test Suite has been added to this plan')).toBeVisible();
	});

	await step(page, 'Open and check the Add Test Suites picker', async () => {
		await wizard.openSuitePicker(allSuites.length);
		await expect(picker.text('Add Filters')).toBeVisible();
		for (const suite of allSuites) {
			await expect(picker.suite(suite)).not.toBeChecked();
		}
		await expect(picker.root.getByRole('img', { name: 'No test suites selected illustration' })).toBeVisible();
		await expect(picker.text('No Test Suite has been added to this plan')).toBeVisible();
		await expect(picker.button('Select')).toBeDisabled();
		await expect(picker.button('Remove')).toBeDisabled();
		await expect(picker.addToPlanButton).toBeDisabled();
		await expect(picker.button('Cancel')).toBeEnabled();
	});

	await step(page, 'Search the available suites', async () => {
		await picker.searchIcon.click();
		await picker.search.fill(plan.suites[0]);
		await picker.expectCounts(1, 0);
		await expect(picker.suite(plan.suites[0])).toBeVisible();
		await picker.search.fill('zz-no-such-suite');
		await picker.expectCounts(0, 0);
		await expect(picker.text(noResults)).toBeVisible();
		await picker.search.clear();
		await picker.expectCounts(allSuites.length, 0);
	});

	await step(page, 'Add every filter and check its options', async () => {
		await picker.text('Add Filters').click();
		for (const filter of suiteFilters) {
			const checkbox = picker.checkbox(filter);
			await expect(checkbox).not.toBeChecked();
			await checkbox.check();
			await expect(checkbox).toBeChecked();
		}
		await picker.closePopover();
		await expect(picker.checkbox(suiteFilters[0])).toBeHidden();

		const shownBefore = await picker.visibleCheckboxes.count();
		for (const filter of suiteFilters) {
			await picker.filter(filter).click();
			if (filter === 'Last Run Result') {
				for (const result of lastRunResults) {
					await expect(picker.checkbox(result)).toBeVisible();
				}
			} else if (filter === 'Linked To') {
				await expect(picker.checkbox('Test Management Tool')).toBeVisible();
			} else if (dateFilters.includes(filter)) {
				await expect(picker.monthButton(currentMonth())).toBeVisible();
			} else {
				// Test Case, Created By and Labels list their options under a search box.
				await expect(picker.visibleSearchBoxes).toHaveCount(1);
				await expect.poll(() => picker.visibleCheckboxes.count(), `options of ${filter}`).toBeGreaterThan(shownBefore);
			}
			await picker.closePopover();
			await expect(picker.visibleSearchBoxes).toHaveCount(0);
			await expect(picker.visibleCheckboxes).toHaveCount(shownBefore);
			await expect(picker.monthButton(currentMonth())).toHaveCount(0);
		}
	});

	await step(page, 'Filter the available suites by last run result and reset the filter', async () => {
		// The suites have never run, so none of them was last paused.
		await picker.filter('Last Run Result').click();
		await picker.text('Paused').click();
		await expect(picker.checkbox('PAUSED')).toBeChecked();
		await picker.closePopover();
		await expect(picker.text('Last Run Result (1)')).toBeVisible();
		await picker.expectCounts(0, 0);
		await expect(picker.text(noResults)).toBeVisible();
		await picker.text('Reset').click();
		await expect(picker.text('Last Run Result (1)')).toHaveCount(0);
		await picker.expectCounts(allSuites.length, 0);
	});

	await step(page, 'Move suites between the lists with Select All, Select and Remove', async () => {
		await picker.selectAll('available').check();
		await picker.button('Select').click();
		await picker.expectCounts(0, allSuites.length);
		await expect(picker.text('All the Test Suites are selected')).toBeVisible();
		await expect(picker.addToPlanButton).toBeEnabled();

		await picker.tick(readdedSuite);
		await expect(picker.button('Remove')).toBeEnabled();
		await picker.button('Remove').click();
		await picker.expectCounts(1, allSuites.length - 1);
		await expect(picker.suite(readdedSuite)).not.toBeChecked();

		await picker.selectAll('available').check();
		await picker.button('Select').click();
		await picker.expectCounts(0, allSuites.length);
	});

	await step(page, 'Add every suite to the plan', async () => {
		await picker.addToPlan();
		await expect(wizard.suitesHeading(allSuites.length)).toBeVisible();
		for (const suite of allSuites) {
			await expect(wizard.text(suite)).toBeVisible();
		}
	});

	await step(page, 'Search the plan\'s suites', async () => {
		await wizard.suiteSearch.fill(plan.suites[0]);
		await expect(wizard.text(plan.suites[0])).toBeVisible();
		for (const suite of allSuites.filter((name) => name !== plan.suites[0])) {
			await expect(wizard.text(suite)).toBeHidden();
		}
		await wizard.suiteSearch.clear();
		for (const suite of allSuites) {
			await expect(wizard.text(suite)).toBeVisible();
		}
	});

	await step(page, `Remove ${removedSuites.length === 1 ? 'a suite' : `${removedSuites.length} suites`} from the plan`, async () => {
		for (const [index, suite] of removedSuites.entries()) {
			await wizard.suiteMenu(suite).click();
			await expect(page.getByText('Manage Test Case', { exact: true })).toBeVisible();
			await page.getByText('Remove Suite', { exact: true }).click();
			// No machine is linked yet, so the suite can only leave the whole plan.
			const confirm = wizard.removeSuiteDialog;
			await expect(confirm.getByRole('radio', { name: 'Remove from this test machine' })).toBeDisabled();
			await expect(confirm.getByRole('radio', { name: 'Remove from all test machines & test plan' })).toBeChecked();
			await confirm.getByRole('button', { name: 'Remove', exact: true }).click();
			await expect(confirm).toBeHidden();
			await expect(wizard.text(suite)).toHaveCount(0);
			await expect(wizard.suitesHeading(allSuites.length - index - 1)).toBeVisible();
		}
	});

	await step(page, `Add ${readdedSuite} back`, async () => {
		const kept = allSuites.length - removedSuites.length;
		await wizard.openSuitePicker(removedSuites.length, kept);
		// Nothing has changed yet, so there is nothing to add.
		await expect(picker.addToPlanButton).toBeDisabled();
		for (const suite of plan.suites.filter((name) => name !== readdedSuite)) {
			await expect(picker.suite(suite)).toBeVisible();
		}
		await picker.tick(readdedSuite);
		await picker.button('Select').click();
		await picker.expectCounts(removedSuites.length - 1, kept + 1);
		await picker.addToPlan();
	});

	await step(page, 'Check the plan has its suites', async () => {
		await expect(wizard.suitesHeading(plan.suites.length)).toBeVisible();
		await expect(wizard.machinesHeading(0)).toBeVisible();
		for (const suite of plan.suites) {
			await expect(wizard.text(suite)).toBeVisible();
		}
		for (const suite of extraSuites) {
			await expect(wizard.text(suite)).toHaveCount(0);
		}
	});
}

// Checks the options behind the Add Machine form's fields, leaving every field as it was.
async function checkMachineFormFields(form: AddMachineForm, plan: PlanScenario) {
	const labels = plan.machineForm.labels;
	if (labels.includes('Browser')) {
		// The form does not always start on the same browser, so check that looking at the menu keeps whichever
		// one it shows.
		const browser = form.dropdown('Browser');
		await expect(browser).toHaveText(/(Chrome|Firefox|Edge) Latest/, { timeout: 30000 });
		const chosen = (await browser.innerText()).trim();
		await openDropdown(browser);
		for (const name of ['Chrome', 'Firefox', 'Edge']) {
			await expect(form.text(name)).toBeVisible();
		}
		// The menu opens upwards over the fields above it, so click the form's title to close it.
		await closeDropdown(browser, form.title);
		await expect(browser).toHaveText(chosen);
	}
	if (labels.includes('App Source')) {
		await expect(form.radio('Uploaded apps')).toBeChecked();
		await expect(form.radio('External link')).not.toBeChecked();
		// An uploaded app is chosen already, shown after the Uploads label.
		await expect(form.fieldLabel('Uploads').locator("xpath=ancestor::div[normalize-space(.) != 'Uploads'][1]")).toHaveText(/^Uploads\s*\*?\s*\S/);
	}
	if (labels.includes('Select backup devices')) {
		await expect(form.root.getByRole('button', { name: 'Add backup devices' })).toBeEnabled();
	}
	if (labels.includes('Pre-requisites')) {
		await expect(form.root.getByRole('link', { name: 'View documentation for more pre-requisite settings' })).toHaveAttribute('href', /testsigma\.com\/docs\//);
		await expect(form.root.getByRole('link', { name: 'Learn how to generate mobile app build with the required configuration' })).toHaveAttribute('href', /testsigma\.com\/docs\//);
	}
	await expect(form.text('Desired Capabilities')).toBeVisible();
}

export async function linkMachineProfiles(run: PlanRun, plan: PlanScenario) {
	const { page } = run;
	const wizard = new CreateTestPlanWizard(page, run.versionId);
	const drawer = new MachineProfilesDrawer(page);
	const addMachine = new AddMachineForm(page);
	let selected = 0;
	const usedDevices: string[] = [];

	await step(page, 'Open and check the machine profiles drawer', async () => {
		await wizard.openMachineDrawer();
		// Only some applications offer ready-made profiles.
		if (plan.predefinedCatalog.length > 0) {
			await expect(drawer.predefinedHeading).toBeVisible();
			for (const machine of plan.predefinedCatalog) {
				await expect(drawer.text(machine)).toBeVisible();
			}
			// None of them runs a suite of this plan yet.
			await expect(drawer.text('No Suites')).toHaveCount(plan.predefinedCatalog.length);
		} else {
			await expect(drawer.predefinedHeading).toHaveCount(0);
		}
		await expect(drawer.addMachineButton).toBeEnabled();
		await expect(drawer.saveSelections).toHaveText('Save selections(0)');
		await expect(drawer.saveSelections).toBeDisabled();
	});

	for (const machine of plan.predefinedMachines) {
		await step(page, `Select the pre-defined ${machine} profile`, async () => {
			await drawer.text(machine).click();
			selected += 1;
			await expect(drawer.saveSelections).toHaveText(`Save selections(${selected})`);
			await expect(drawer.saveSelections).toBeEnabled();
		});
	}

	await step(page, 'Switch test labs, then cancel the Add Machine form without creating a profile', async () => {
		await drawer.openAddMachine();
		await addMachine.nameField.fill(cancelledMachine);
		await addMachine.switchTestLabs();
		await addMachine.cancelButton.click();
		await addMachine.expectClosed();
		await expect(drawer.text(cancelledMachine)).toHaveCount(0);
		await expect(drawer.saveSelections).toHaveText(`Save selections(${selected})`);
	});

	for (const [index, machine] of plan.userDefinedMachines.entries()) {
		await step(page, `Open${index === 0 ? ' and check' : ''} the Add Machine form for ${machine.name}`, async () => {
			await drawer.openAddMachine();
			await expect(addMachine.nameField).toBeVisible({ timeout: 30000 });
			await expect(addMachine.nameField).toBeEmpty();
			// A profile needs a name before it can be created.
			await expect(addMachine.createProfileButton).toBeDisabled();
			if (index > 0) {
				return;
			}
			for (const label of plan.machineForm.labels) {
				await expect(addMachine.fieldLabel(label)).toBeVisible();
			}
			for (const lab of testLabs) {
				await expect(addMachine.labButton(lab)).toBeVisible();
			}
			for (const option of plan.machineForm.checked) {
				await expect(addMachine.checkbox(option)).toBeChecked();
			}
			for (const option of plan.machineForm.unchecked) {
				await expect(addMachine.checkbox(option)).not.toBeChecked();
			}
			// Running suites in parallel is only offered when the plan has more than one suite.
			if (plan.suites.length === 1) {
				await expect(addMachine.checkbox('Run test suites in parallel')).toHaveCount(0);
			}
			await checkMachineFormFields(addMachine, plan);
		});

		await step(page, `Create the user-defined ${machine.name} profile`, async () => {
			await addMachine.nameField.fill(machine.name);
			// Device profiles record their device, so later ones can be put on a different one. The device list
			// loads after the form opens, so wait for it rather than checking whether it is there yet.
			if (plan.machineForm.labels.includes('Device')) {
				await expect(addMachine.deviceField).toHaveText(/\S/, { timeout: 30000 });
				const device = machine.otherDevice
					? await addMachine.chooseUnusedDevice(usedDevices)
					: (await addMachine.deviceField.innerText()).trim();
				usedDevices.push(device);
				test.info().annotations.push({ type: `${machine.name} device`, description: device });
			}
			if (index === 0) {
				await addMachine.choose(plan.machineChoices);
			}
			await addMachine.createProfile();
			// The new profile joins the user-defined list already selected.
			await expect(drawer.text(machine.name)).toBeVisible();
			selected += 1;
			await expect(drawer.saveSelections).toHaveText(`Save selections(${selected})`);
		});
	}

	await step(page, 'Save the selections and check every machine runs every suite', async () => {
		const machines = allMachines(plan);
		await drawer.save();
		await expect(wizard.machinesHeading(machines.length)).toBeVisible();
		for (const machine of machines) {
			await expect(wizard.text(machine).first()).toBeVisible();
		}
		await expect(wizard.machineSuiteCounts(plan.suites.length)).toHaveCount(machines.length);
	});

	await step(page, 'Continue to Test Plan Settings', async () => {
		await wizard.continueButton.click();
		await expect(wizard.sendNotification).toBeAttached({ timeout: 30000 });
		await expect(wizard.createButton).toBeEnabled();
	});
}

export async function fillPlanSettings(run: PlanRun, plan: PlanScenario) {
	const { page } = run;
	const wizard = new CreateTestPlanWizard(page, run.versionId);

	await step(page, 'Check the settings and their defaults', async () => {
		await wizard.expectSteps();
		await expect(wizard.sendNotification).not.toBeChecked();
		await expect(wizard.text('Additional Settings')).toBeVisible();
		for (const label of ['Environment', 'Screenshot capture', 'Recovery Actions', 'Post Plan Hook', 'Addon', ...(plan.extraSettings ?? [])]) {
			await expect(wizard.fieldLabel(label)).toBeVisible();
		}
		await expect(wizard.text('For all steps')).toBeVisible();
		await expect(wizard.timeout('Page Timeout')).toHaveValue('30');
		await expect(wizard.timeout('Step Timeout')).toHaveValue('30');
		await expect(wizard.main.getByRole('checkbox', { name: 'Apply to all steps' })).not.toBeChecked();
		await expect(wizard.main.getByRole('checkbox', { name: 'Accessibility Testing' })).not.toBeChecked();
		await expect(wizard.main.getByRole('link', { name: 'WCAG guidelines' })).toHaveAttribute('href', 'https://www.w3.org/standards/about/');
		// Recipients only appear once notifications are on.
		await expect(wizard.emailField).toHaveCount(0);
	});

	await step(page, 'Turn on notifications', async () => {
		await wizard.turnOn('Send Notification');
		await expect(wizard.text('Notify On')).toBeVisible();
		for (const status of notificationStatuses) {
			await expect(wizard.statusChip(status)).toBeVisible();
		}
	});

	await step(page, `Notify on ${plan.notifyOn.join(' and ')} runs`, async () => {
		for (const status of plan.notifyOn) {
			await wizard.chooseStatus(status);
		}
		await expect(wizard.text('Send Notification to')).toBeVisible();
		await expect(wizard.main.getByRole('checkbox', { name: 'Add my email' })).toBeAttached();
		await expect(wizard.main.getByRole('link', { name: 'Open chat integrations' })).toHaveAttribute('href', '/ui/settings/plugs');
	});

	await step(page, 'An invalid email address is not added', async () => {
		await wizard.emailField.fill(invalidEmail);
		await wizard.emailField.press('Enter');
		// Enter only turns a valid address into a chip; anything else stays in the box.
		await expect(wizard.emailField).toHaveValue(invalidEmail);
		await wizard.emailField.clear();
		await expect(wizard.text(invalidEmail)).toHaveCount(0);
	});

	await step(page, `Add ${plan.notificationEmail} as a recipient`, async () => {
		await wizard.emailField.fill(plan.notificationEmail);
		await wizard.emailField.press('Enter');
		// The address becomes a chip and the box clears for the next one.
		await expect(wizard.emailField).toBeEmpty();
		await expect(wizard.text(plan.notificationEmail)).toBeVisible();
	});

	await step(page, 'Add my email as a recipient', async () => {
		await wizard.turnOn('Add my email');
		await expect(wizard.text(accountEmail)).toBeVisible();
		await expect(wizard.text(plan.notificationEmail)).toBeVisible();
	});

	await step(page, 'Choose an environment', async () => {
		const environment = wizard.dropdown('Environment');
		await expect(environment).toHaveText('None');
		await openDropdown(environment);
		const options = (await wizard.main.getByRole('gridcell').filter({ visible: true }).allInnerTexts()).map((text) => text.trim());
		expect(options[0]).toBe('None');
		// Environments belong to the project, which may have none besides "None".
		run.environment = options.find((option) => option && option !== 'None');
		if (!run.environment) {
			test.info().annotations.push({ type: 'environment', description: 'The project has no environments to choose.' });
			await closeDropdown(environment, wizard.text('Additional Settings'));
			return;
		}
		await wizard.main.getByRole('gridcell', { name: run.environment, exact: true }).click();
		await expect(environment).toHaveText(run.environment);
	});

	await step(page, 'Capture screenshots only for failed steps', async () => {
		const screenshots = wizard.dropdown('Screenshot capture');
		await openDropdown(screenshots);
		for (const option of screenshotOptions) {
			await expect(wizard.text(option).last()).toBeVisible();
		}
		await wizard.text('Only for failed Steps').click();
		await expect(screenshots).toHaveText('Only for failed Steps');
	});

	await step(page, 'Timeouts over 120 seconds are refused', async () => {
		for (const name of ['Page Timeout', 'Step Timeout'] as const) {
			await wizard.timeout(name).fill(timeouts.tooLong);
			await wizard.timeout(name).blur();
			await expect(wizard.timeoutTooLong(name)).toBeVisible();
		}
	});

	await step(page, `Set the page timeout to ${timeouts.page} and the step timeout to ${timeouts.step} seconds`, async () => {
		for (const [name, value] of [['Page Timeout', timeouts.page], ['Step Timeout', timeouts.step]] as const) {
			const timeout = wizard.timeout(name);
			await timeout.fill(value);
			await timeout.blur();
			await expect(timeout).toHaveValue(value);
			await expect(wizard.timeoutTooLong(name)).toHaveCount(0);
		}
		await wizard.turnOn('Apply to all steps');
	});

	await step(page, 'Turn on accessibility testing', async () => {
		await expect(wizard.text('WCAG Version & Conformance Level')).toHaveCount(0);
		await wizard.turnOn('Accessibility Testing');
		await expect(wizard.text('WCAG Version & Conformance Level')).toBeVisible();
		await expect(wizard.text('WCAG 2.1 AA')).toBeVisible();
	});

	await step(page, 'Change every recovery action', async () => {
		// The actions stay folded away until their heading is clicked.
		await expect(wizard.settingsRow(recoveryActions[0].when)).toHaveCount(0);
		await wizard.text('Recovery Actions').click();
		for (const { when, choices: [byDefault, other] } of recoveryActions) {
			const row = wizard.settingsRow(when);
			await expect(row.getByRole('radio', { name: byDefault, exact: true })).toBeChecked();
			await expect(row.getByRole('radio', { name: other, exact: true })).not.toBeChecked();
			await choose(row, other);
			await expect(row.getByRole('radio', { name: byDefault, exact: true })).not.toBeChecked();
		}
		const rerun = wizard.settingsRow('Rerun on failure');
		await expect(rerun.getByRole('radio', { name: rerunChoices[0], exact: true })).toBeChecked();
		for (const choice of rerunChoices.slice(1)) {
			await expect(rerun.getByRole('radio', { name: choice, exact: true })).not.toBeChecked();
		}
		await choose(rerun, 'Only Failed Test Cases');
	});

	await step(page, 'Check the post plan hook offers no addon', async () => {
		const addon = wizard.dropdown('Addon');
		await expect(addon).toHaveText('None');
		// The open list adds its own "None" beside the ones the dropdowns already show.
		const nones = wizard.text('None').filter({ visible: true });
		const shownBefore = await nones.count();
		await openDropdown(addon);
		await expect(nones).toHaveCount(shownBefore + 1);
		await closeDropdown(addon, wizard.text('Post Plan Hook'));
		await expect(addon).toHaveText('None');
	});
}

export async function createPlan(run: PlanRun, plan: PlanScenario) {
	const { page, versionId } = run;
	const api = new TestPlansApi(page, versionId);
	const wizard = new CreateTestPlanWizard(page, versionId);
	const machineNames = allMachines(plan);

	await step(page, 'Create the plan and check the saved details', async () => {
		const createResponse = page.waitForResponse((response) => isPlanCreate(response.request()));
		await wizard.createButton.click();
		const response = await createResponse;
		expect(response.status()).toBe(201);
		expect(response.request().postDataJSON()).toMatchObject({ name: plan.name, description: plan.description });
		const saved = await response.json();
		run.planId = saved.id;
		// The status chips are saved by position: Passed is "0", Failed is "1" and so on.
		const statusCodes = plan.notifyOn.map((status) => String(notificationStatuses.indexOf(status))).sort();
		expect(saved).toMatchObject({
			name: plan.name,
			description: plan.description,
			applicationVersionId: versionId,
			executionType: 'CROSS_BROWSER',
			...savedSettings,
		});
		expect(saved.mailList.split(',').map((email: string) => email.trim()).sort()).toEqual([plan.notificationEmail, accountEmail].sort());
		expect([...saved.notificationStatusList].sort()).toEqual(statusCodes);
		// The label removed before saving is not among them.
		expect([...saved.tags].sort()).toEqual([...plan.labels].sort());
		if (run.environment) {
			expect(saved.environmentId, `environment ${run.environment}`).toEqual(expect.any(Number));
		} else {
			expect(saved.environmentId).toBeNull();
		}
	});

	await step(page, 'Check the plan details page', async () => {
		const details = new TestPlanDetailsPage(page, run.planId);
		await details.expectOpen(plan.name);
		for (const control of ['Edit', 'Delete'] as const) {
			await expect(details.button(control)).toBeVisible();
		}
		await expect(details.viewReports).toHaveAttribute('href', new RegExp(`/plans/${run.planId}/details$`));
		for (const machine of machineNames) {
			const row = details.machineRow(machine);
			await expect(row).toBeVisible();
			await expect(row.getByRole('checkbox')).toBeChecked();
		}
	});

	await step(page, 'Check every machine runs every suite', async () => {
		const machines = await api.machines(run.planId);
		expect(machines.map((machine) => machine.title).sort()).toEqual([...machineNames].sort());
		const expectedSuiteIds = plan.suites.map((suite) => run.suiteIds.get(suite)!).sort();
		for (const machine of machines) {
			expect([...machine.suiteIds].sort(), `suites of ${machine.title}`).toEqual(expectedSuiteIds);
			expect(machine.isPredefined, `${machine.title} is pre-defined`).toBe(plan.predefinedMachines.includes(machine.title));
		}
		const [firstUserDefined] = plan.userDefinedMachines;
		expect(machines.find((machine) => machine.title === firstUserDefined.name), `settings of ${firstUserDefined.name}`)
			.toMatchObject(plan.machineChoices.saved);
		expect(machines.some((machine) => machine.title === cancelledMachine)).toBe(false);
		// Profiles asked to use another device run on a device of their own.
		if (plan.userDefinedMachines.some((machine) => machine.otherDevice)) {
			const devices = machines.map((machine) => machine.platformDeviceId);
			expect(new Set(devices).size, `devices ${devices.join(', ')}`).toBe(machines.length);
		}
		expect((await api.list()).filter((item) => item.name === plan.name)).toHaveLength(1);
	});
}

export async function verifyPlanInList(run: PlanRun, plan: PlanScenario) {
	const { page, versionId } = run;
	const plansPage = new TestPlansPage(page, versionId);
	const plans = await new TestPlansApi(page, versionId).list();

	await step(page, 'Open Test Plans', async () => {
		await plansPage.openFromNavigation();
		await expect(plansPage.text(`All (${plans.length})`)).toBeVisible({ timeout: 30000 });
		for (const column of ['Name', 'Test Plan Type', 'Test Lab & Test Machines', 'Actions']) {
			await expect(plansPage.text(column)).toBeVisible();
		}
	});

	await step(page, 'Search for the plan', async () => {
		await plansPage.search.fill(plan.name);
		await expect(plansPage.text('Filtered (1)')).toBeVisible({ timeout: 30000 });
		const row = plansPage.planRow(plan.name);
		await expect(row.getByRole('link', { name: plan.name, exact: true })).toHaveAttribute('href', `/ui/td/plans/${run.planId}/details`);
		await expect(row.getByRole('gridcell', { name: 'Cross Browser', exact: true })).toBeVisible();
		for (const action of ['Schedule', 'Reports', 'Run']) {
			await expect(row.getByText(action, { exact: true })).toBeVisible();
		}
	});

	await step(page, 'Search for a plan that does not exist', async () => {
		await plansPage.search.fill('zz-no-such-plan');
		await expect(plansPage.text('Filtered (0)')).toBeVisible({ timeout: 30000 });
		await expect(plansPage.text(noResults)).toBeVisible();
		await expect(plansPage.main.getByRole('img', { name: 'Empty state illustration' })).toBeVisible();
		await plansPage.search.clear();
		await expect(plansPage.main.getByText(/^Filtered \(\d+\)$/)).toHaveCount(0);
		await expect(plansPage.planLink(plan.name)).toBeVisible();
	});

	await step(page, 'Show and hide the filters', async () => {
		await plansPage.text('Show Filters').click();
		await expect(plansPage.text('Hide Filters')).toBeVisible();
		await expect(plansPage.text('Add Filter')).toBeVisible();
		await plansPage.text('Hide Filters').click();
		await expect(plansPage.text('Show Filters')).toBeVisible();
		await expect(plansPage.text('Add Filter')).toHaveCount(0);
	});

	await step(page, 'Check the sort options', async () => {
		// "Name" is also a column heading, so each option must add one more of its text to the page.
		const shownBefore = await Promise.all(sortOptions.map((option) => plansPage.text(option).filter({ visible: true }).count()));
		await plansPage.text('Sort by').click();
		for (const [index, option] of sortOptions.entries()) {
			await expect(plansPage.text(option).filter({ visible: true })).toHaveCount(shownBefore[index] + 1);
		}
		await page.keyboard.press('Escape');
	});
}
