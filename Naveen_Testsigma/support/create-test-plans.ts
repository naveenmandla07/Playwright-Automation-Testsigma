/**
 * Steps shared by the "Create test plan" specs under Test Plan Module. Each application of the
 * "[9.0.8] Accessibility" project has its own spec, which declares the tests, describes its plan as a
 * PlanScenario and runs these steps for it.
 */
import { expect, test, type Locator, type Page, type Request } from '@playwright/test';
import { hoverNavigation, type SuiteApplication } from './create-test-suites';

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

type Plan = { id: number; name: string };
type PlanMachine = { id: number; title: string; suiteIds: number[]; isPredefined: boolean; platformDeviceId: string | null } & Record<string, unknown>;

const wizardSteps = ['Basic Details', 'Add Test Suites & Link Machine Profiles', 'Test Plan Settings'];
const testLabs = ['Testsigma Lab', 'Local Devices', 'Lambda Test', 'Sauce Labs', 'BrowserStack'];
const notificationStatuses = ['Passed', 'Failed', 'Not Executed', 'Queued', 'Stopped', 'Running'];

// A label added and then removed again, so it must not be saved with the plan.
const discardedLabel = 'discarded-label';
const invalidEmail = 'not-an-email';
const cancelledMachine = 'Cancelled machine profile';
const noResults = 'No results found for this search criteria';

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

// Plans and their machines are served from the site root rather than /private.
async function listPlans(page: Page, versionId: number): Promise<Plan[]> {
	const response = await page.request.get(`/executions?query=applicationVersionId:${versionId},entityType:EXECUTION&size=500&page=0`);
	expect(response.ok()).toBe(true);
	return (await response.json()).content;
}

async function listPlanMachines(page: Page, planId: number): Promise<PlanMachine[]> {
	const response = await page.request.get(`/execution_environments?query=executionId:${planId}&fetchSuitesCount=true&page=0&size=100`);
	expect(response.ok()).toBe(true);
	return (await response.json()).content;
}

async function suiteIdsByName(page: Page, versionId: number) {
	const response = await page.request.get(`/private/test_suites?query=appVersionId:${versionId},suiteType:TS_SUITE&size=500&page=0`);
	expect(response.ok()).toBe(true);
	const suites: { id: number; name: string }[] = (await response.json()).content;
	return new Map(suites.map((suite) => [suite.name, suite.id]));
}

// The hidden checkbox of a toggle does not take clicks; its switch, the surrounding label, does.
async function turnOn(scope: Locator, page: Page, name: string) {
	const checkbox = scope.getByRole('checkbox', { name, exact: true });
	if (!(await checkbox.isChecked())) {
		await toggle(scope, page, name).click();
	}
	await expect(checkbox).toBeChecked();
}

function wizard(page: Page) {
	return page.locator('main');
}

// Modals and drawers here are plain overlays rather than dialogs, so find each by its title and main button.
function overlay(page: Page, title: string, button: string | RegExp) {
	return page.locator('div')
		.filter({ has: page.getByText(title, { exact: true }) })
		.filter({ has: page.getByRole('button', { name: button }) })
		.last();
}

// Field labels can carry a required-field asterisk, e.g. "Test Lab *".
function fieldLabel(scope: Locator, label: string) {
	return scope.getByText(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')}\\s*\\*?$`)).first();
}

// Machine cards show how many suites they run, e.g. "2 Suites".
function suiteCount(count: number) {
	return new RegExp(`^${count} Suites?$`);
}

// A dropdown sits next to its label and shows the chosen value; it reports whether it is open in data-isopen.
function dropdown(scope: Locator, label: string) {
	return fieldLabel(scope, label).locator('..').locator('[data-isopen]').first();
}

async function openDropdown(field: Locator) {
	await field.click();
	await expect(field).toHaveAttribute('data-isopen', 'true');
}

// Escape leaves a dropdown open, and clicking the dropdown again can land on one of its options, so close it by
// clicking a heading next to it.
async function closeDropdown(field: Locator, heading: Locator) {
	await heading.click();
	await expect(field).toHaveAttribute('data-isopen', 'false');
}

// Radio buttons are hidden behind their labels, so choose one by clicking its text.
async function choose(scope: Locator, name: string) {
	await scope.getByText(name, { exact: true }).click();
	await expect(scope.getByRole('radio', { name, exact: true })).toBeChecked();
}

// The label switch of a toggle, which is what takes the click; see turnOn.
function toggle(scope: Locator, page: Page, name: string) {
	return scope.locator('label').filter({ has: page.getByRole('checkbox', { name, exact: true }) });
}

async function expectWizardSteps(page: Page) {
	for (const [index, label] of wizardSteps.entries()) {
		await expect(wizard(page).getByText(label, { exact: true })).toBeVisible();
		await expect(wizard(page).getByText(String(index + 1), { exact: true }).first()).toBeVisible();
	}
}

// Fills in the name and description, leaving any that already hold the right value alone.
async function enterNameAndDescription(page: Page, plan: PlanScenario) {
	const main = wizard(page);
	const name = main.getByRole('textbox', { name: 'Name', exact: true });
	if ((await name.inputValue()) !== plan.name) {
		await name.fill(plan.name);
	}
	await expect(name).toHaveValue(plan.name);

	await turnOn(main, page, 'Description');
	const description = main.getByRole('textbox', { name: 'Description', exact: true });
	await expect(description).toBeEditable();
	if ((await description.inputValue()) !== plan.description) {
		await description.clear();
		await description.pressSequentially(plan.description);
		await description.blur();
	}
	await expect(description).toHaveValue(plan.description);
}

// Turning the description on can clear the form's own copy of it a moment later while the box keeps showing
// the text, so the plan would be saved without it. An edit made once the form has settled hands the form the
// full text again.
async function commitDescription(page: Page, plan: PlanScenario) {
	const description = wizard(page).getByRole('textbox', { name: 'Description', exact: true });
	await description.click();
	await description.press('End');
	await description.press('Space');
	await description.press('Backspace');
	await description.blur();
	await expect(description).toHaveValue(plan.description);
}

function labelChip(page: Page, label: string) {
	return wizard(page).getByText(label, { exact: true });
}

// Each label is added by typing it and pressing Enter, which turns it into a chip and clears the box.
async function addMissingLabels(page: Page, plan: PlanScenario) {
	const labels = wizard(page).getByRole('textbox', { name: 'Labels', exact: true });
	for (const label of plan.labels) {
		if (await labelChip(page, label).isVisible()) {
			continue;
		}
		await labels.fill(label);
		await labels.press('Enter');
		await expect(labels).toBeEmpty();
		await expect(labelChip(page, label)).toBeVisible();
	}
}

function deviceField(form: Locator) {
	return form.getByText('Device', { exact: true }).locator('..').locator('[data-isopen]');
}

// Keeps the form's device unless an earlier profile already uses it, in which case it picks one that none
// does. Returns the device the profile will use.
async function chooseUnusedDevice(page: Page, form: Locator, used: string[]) {
	const device = deviceField(form);
	const current = (await device.innerText()).trim();
	if (!used.includes(current)) {
		return current;
	}
	await device.click();
	// The open list ticks the current device; the other devices are the entries next to it.
	const currentEntry = page.locator('div')
		.filter({ has: page.getByText(current, { exact: true }) })
		.filter({ has: page.getByTestId('check-circle') })
		.last();
	await expect(currentEntry).toBeVisible();
	const list = currentEntry.locator('xpath=..');
	await expect(list.locator('xpath=./div/span').first()).toBeVisible();
	const options = (await list.locator('xpath=./div/span').allInnerTexts()).map((text) => text.trim());
	const unused = options.find((option) => option && !used.includes(option));
	expect(unused, `a device other than ${used.join(', ')}`).toBeDefined();
	await list.getByText(unused!, { exact: true }).click();
	await expect(device).toHaveText(unused!);
	return unused!;
}

function allMachines(plan: PlanScenario) {
	return [...plan.predefinedMachines, ...plan.userDefinedMachines.map((machine) => machine.name)];
}

export async function verifyTestPlansPage(run: PlanRun, plan: PlanScenario) {
	const { page, versionId } = run;

	await step(page, 'Check the suites the plan needs', async () => {
		run.suiteIds = await suiteIdsByName(page, versionId);
		for (const suite of plan.suites) {
			expect(run.suiteIds.has(suite), `Suite "${suite}" is missing; run "${plan.suiteSpec}" first`).toBe(true);
		}
	});

	await step(page, 'Remove a plan left by an earlier run', async () => {
		for (const existing of (await listPlans(page, versionId)).filter((item) => item.name === plan.name)) {
			expect((await page.request.delete(`/executions/${existing.id}`)).ok()).toBe(true);
		}
		await expect.poll(async () => (await listPlans(page, versionId)).some((item) => item.name === plan.name)).toBe(false);
	});

	await step(page, 'Open Test Plans', async () => {
		await hoverNavigation(page, 300);
		await page.getByRole('link', { name: 'Test Plans', exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`/td/${versionId}/plans$`), { timeout: 30000 });
		const main = wizard(page);
		await expect(main.getByRole('link', { name: 'Test Plans', exact: true })).toBeVisible({ timeout: 30000 });
		await expect(main.getByRole('link', { name: 'Schedules', exact: true })).toHaveAttribute('href', `/ui/td/${versionId}/plans/schedules`);
		await expect(main.getByRole('button', { name: 'Refresh' })).toBeEnabled();
		await expect(main.getByRole('button', { name: 'Create Test Plan' }).first()).toBeEnabled();
		// The page shows either an empty state or the existing plans.
		const plans = await listPlans(page, versionId);
		if (plans.length === 0) {
			await expect(main.getByText('There are no Test Plan created.', { exact: true })).toBeVisible();
			await expect(main.getByRole('img', { name: 'Empty state illustration' })).toBeVisible();
		} else {
			await expect(main.getByText(plans[0].name, { exact: true }).first()).toBeVisible();
		}
	});
}

export async function fillBasicDetails(run: PlanRun, plan: PlanScenario) {
	const { page, versionId } = run;
	const main = wizard(page);

	await step(page, 'Open the Create Test Plan wizard', async () => {
		const continueButton = main.getByRole('button', { name: 'Continue', exact: true });
		// The wizard loads the existing labels after it appears and re-renders its fields when they arrive,
		// dropping anything typed before then, so wait for them before typing.
		const labelsLoaded = page.waitForResponse((response) => new URL(response.url()).pathname === '/test_plan_tags' && response.ok(), { timeout: 45000 });
		// The address changes before the wizard replaces the list, so wait for the wizard itself and click
		// again if it has not opened.
		await expect(async () => {
			if (!(await continueButton.isVisible())) {
				await main.getByRole('button', { name: 'Create Test Plan' }).first().click({ timeout: 5000 });
			}
			await expect(continueButton).toBeVisible({ timeout: 10000 });
		}).toPass({ timeout: 45000 });
		await labelsLoaded;
		await expect(page).toHaveURL(new RegExp(`/td/${versionId}/plans/new$`));
		await expect(main.getByRole('button', { name: 'Create Test Plan' })).toHaveCount(0);
		await expect(main.getByText('Create Test Plan', { exact: true })).toBeVisible();
		await expect(main.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
		await expect(continueButton).toBeEnabled();
		await expectWizardSteps(page);
	});

	await step(page, 'Check the Basic Details fields', async () => {
		await expect(main.getByRole('textbox', { name: 'Name', exact: true })).toBeEmpty();
		await expect(main.getByRole('textbox', { name: 'Name', exact: true })).toHaveAttribute('placeholder', 'Enter Name');
		await expect(main.getByRole('checkbox', { name: 'Description', exact: true })).not.toBeChecked();
		await expect(main.getByRole('textbox', { name: 'Labels', exact: true })).toBeEmpty();
		await expect(main.getByText('Test Plan Type', { exact: true })).toBeVisible();
		await expect(main.getByText('Use single/multiple browsers to test all test suites', { exact: true })).toBeVisible();
		await expect(main.getByText('Manually add test machine profiles to individual test suites', { exact: true })).toBeVisible();
	});

	await step(page, 'A plan cannot be created without a name', async () => {
		// The wizard lets every step be passed without a name and only checks it on Create, which sends the
		// user back to Basic Details instead of saving the plan.
		const creates: string[] = [];
		const recordCreate = (request: Request) => {
			if (request.method() === 'POST' && /\/executions$/.test(new URL(request.url()).pathname)) {
				creates.push(request.url());
			}
		};
		page.on('request', recordCreate);
		try {
			await main.getByRole('button', { name: 'Continue', exact: true }).click();
			await expect(main.getByText('Test Suites (0)', { exact: true })).toBeVisible({ timeout: 30000 });
			await main.getByRole('button', { name: 'Continue', exact: true }).click();
			await expect(main.getByRole('checkbox', { name: 'Send Notification', exact: true })).toBeAttached({ timeout: 30000 });
			await main.getByRole('button', { name: 'Create', exact: true }).click();
			await expect(main.getByText('Name is required', { exact: true })).toBeVisible({ timeout: 30000 });
			await expect(main.getByRole('textbox', { name: 'Name', exact: true })).toBeEmpty();
			await expect(main.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
		} finally {
			page.off('request', recordCreate);
		}
		expect(creates, 'plans created without a name').toEqual([]);
		expect((await listPlans(page, versionId)).some((item) => !item.name)).toBe(false);
	});

	await step(page, 'Choose the Cross browser testing plan type', async () => {
		const crossBrowser = main.getByRole('radio', { name: /^Cross browser testing/ });
		const custom = main.getByRole('radio', { name: /^Custom test plan/ });
		// Cross browser testing is the default; switch away and back to check the choice sticks.
		await expect(crossBrowser).toBeChecked();
		await main.getByText('Custom test plan', { exact: true }).click();
		await expect(custom).toBeChecked();
		await expect(crossBrowser).not.toBeChecked();
		await main.getByText('Cross browser testing', { exact: true }).click();
		await expect(crossBrowser).toBeChecked();
		await expect(custom).not.toBeChecked();
	});

	await step(page, 'Enter the name and description', async () => {
		await enterNameAndDescription(page, plan);
		await expect(main.getByText('Name is required', { exact: true })).toBeHidden();
	});

	await step(page, 'Add the labels', async () => {
		await addMissingLabels(page, plan);
	});

	await step(page, 'Add a label with "+ Add" and remove it again', async () => {
		const labels = main.getByRole('textbox', { name: 'Labels', exact: true });
		// "+ Add" is offered in the suggestions, which open when the box is clicked and follow the label as it is
		// typed; filling the box in one go does not update them.
		await page.keyboard.press('Escape');
		await labels.click();
		await labels.pressSequentially(discardedLabel);
		await main.getByRole('button', { name: '+ Add' }).click();
		await expect(labels).toBeEmpty();
		await expect(labelChip(page, discardedLabel)).toBeVisible();
		// The first click anywhere only closes the suggestions, so close them before removing the chip.
		await main.getByText('Test Plan Type', { exact: true }).click();
		await labelChip(page, discardedLabel).locator('..').getByTestId(/^remove-button-/).click();
		// The plan's own labels are checked, and put back if the form dropped them, before leaving the step.
		await expect(labelChip(page, discardedLabel)).toHaveCount(0);
	});

	await step(page, 'Cancel asks before leaving the wizard', async () => {
		await main.getByRole('button', { name: 'Cancel', exact: true }).click();
		const confirm = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Leave test plan creation?' }) });
		await expect(confirm.getByText('You will lose all your progress and all changes will be discarded.')).toBeVisible();
		await expect(confirm.getByRole('button', { name: 'Leave', exact: true })).toBeEnabled();
		// Staying keeps everything entered so far.
		await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(confirm).toBeHidden();
		await expect(page).toHaveURL(new RegExp(`/td/${versionId}/plans/new$`));
		await expect(main.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(plan.name);
	});

	await step(page, 'Continue to Add Test Suites', async () => {
		// Everything entered must still be in place before leaving the step; put back anything that was lost.
		await expect(async () => {
			await enterNameAndDescription(page, plan);
			await addMissingLabels(page, plan);
			await expect(main.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(plan.name, { timeout: 2000 });
			await expect(main.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue(plan.description, { timeout: 2000 });
			for (const label of plan.labels) {
				await expect(labelChip(page, label)).toBeVisible({ timeout: 2000 });
			}
		}).toPass({ timeout: 45000 });
		await commitDescription(page, plan);
		await main.getByRole('button', { name: 'Continue', exact: true }).click();
		await expect(main.getByText(/^Test Suites \(0\)/).first()).toBeVisible({ timeout: 30000 });
	});
}

function suitePicker(page: Page) {
	return overlay(page, 'Add Test Suites to plan', 'Add to Plan');
}

// Each suite in the picker has a checkbox named after it, in whichever of its two lists it is.
function pickerSuite(picker: Locator, suite: string) {
	// "Select All" would also match "Select All test cases…", so match each name exactly.
	return picker.getByRole('checkbox', { name: `Select ${suite}`, exact: true }).first();
}

function selectAll(picker: Locator, list: 'available' | 'selected') {
	const checkboxes = picker.getByRole('checkbox', { name: 'Select All', exact: true });
	return list === 'available' ? checkboxes.first() : checkboxes.last();
}

async function expectPickerCounts(picker: Locator, available: number, selected: number) {
	await expect(picker.getByText(`Available Test Suites (${available})`, { exact: true })).toBeVisible({ timeout: 30000 });
	await expect(picker.getByText(`Selected for Test plan (${selected})`, { exact: true })).toBeVisible();
}

// Suites already in the plan open in the selected list.
async function openSuitePicker(page: Page, available: number, selected = 0) {
	const picker = suitePicker(page);
	// The link beside the suites heading is there whether or not the plan has suites yet; the button under an
	// empty list is not.
	await wizard(page).getByText('Add Test Suites', { exact: true }).first().click();
	await expectPickerCounts(picker, available, selected);
	return picker;
}

// The picker's checkboxes toggle through their labels; clicking the text next to one ticks it.
async function tickSuite(picker: Locator, suite: string) {
	const checkbox = pickerSuite(picker, suite);
	await expect(checkbox).toBeVisible();
	await checkbox.check();
	await expect(checkbox).toBeChecked();
}

// Each suite row of the plan has a menu, behind its three-dot icon, to manage or remove the suite.
function planSuiteMenu(page: Page, suite: string) {
	return wizard(page).getByText(suite, { exact: true }).first()
		.locator('xpath=ancestor::div[.//*[@data-testid="more-vertical"]][1]')
		.getByTestId('more-vertical');
}

// A filter's options open in a popover under its name; the search-based ones show a search box of their own.
function visibleSearchBoxes(picker: Locator) {
	return picker.getByRole('textbox', { name: 'Search' }).filter({ visible: true });
}

// The picker's popovers ignore Escape and close on a click elsewhere, such as on the picker's title.
async function closePickerPopover(picker: Locator) {
	await picker.getByText('Add Test Suites to plan', { exact: true }).click();
}

function currentMonth() {
	return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export async function addTestSuites(run: PlanRun, plan: PlanScenario) {
	const { page } = run;
	const main = wizard(page);
	const picker = suitePicker(page);
	// Every suite of the version is offered; the plan keeps only its own.
	const allSuites = [...run.suiteIds.keys()];
	const extraSuites = allSuites.filter((suite) => !plan.suites.includes(suite));
	const readdedSuite = plan.suites[plan.suites.length - 1];
	const removedSuites = [...extraSuites, readdedSuite];

	await step(page, 'Check the empty suites list', async () => {
		await expect(main.getByText('No Test Suite has been added to this plan', { exact: true })).toBeVisible();
		await expect(main.getByRole('img', { name: 'No test suites added illustration' })).toBeVisible();
		await expect(main.getByRole('button', { name: 'Add Test Suites' })).toBeEnabled();
	});

	await step(page, 'Cancelling the picker adds nothing', async () => {
		await openSuitePicker(page, allSuites.length);
		await tickSuite(picker, plan.suites[0]);
		await picker.getByRole('button', { name: 'Select', exact: true }).click();
		await expectPickerCounts(picker, allSuites.length - 1, 1);
		await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(page.getByText('Add Test Suites to plan', { exact: true })).toBeHidden();
		await expect(main.getByText('Test Suites (0)', { exact: true })).toBeVisible();
		await expect(main.getByText('No Test Suite has been added to this plan', { exact: true })).toBeVisible();
	});

	await step(page, 'Open and check the Add Test Suites picker', async () => {
		await openSuitePicker(page, allSuites.length);
		await expect(picker.getByText('Add Filters', { exact: true })).toBeVisible();
		for (const suite of allSuites) {
			await expect(pickerSuite(picker, suite)).not.toBeChecked();
		}
		await expect(picker.getByRole('img', { name: 'No test suites selected illustration' })).toBeVisible();
		await expect(picker.getByText('No Test Suite has been added to this plan', { exact: true })).toBeVisible();
		await expect(picker.getByRole('button', { name: 'Select', exact: true })).toBeDisabled();
		await expect(picker.getByRole('button', { name: 'Remove', exact: true })).toBeDisabled();
		await expect(picker.getByRole('button', { name: 'Add to Plan' })).toBeDisabled();
		await expect(picker.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
	});

	await step(page, 'Search the available suites', async () => {
		// The search box stays collapsed until its icon is clicked.
		await picker.getByTestId('search').first().click();
		const search = picker.getByRole('textbox', { name: 'Search' }).first();
		await search.fill(plan.suites[0]);
		await expectPickerCounts(picker, 1, 0);
		await expect(pickerSuite(picker, plan.suites[0])).toBeVisible();
		await search.fill('zz-no-such-suite');
		await expectPickerCounts(picker, 0, 0);
		await expect(picker.getByText(noResults, { exact: true })).toBeVisible();
		await search.clear();
		await expectPickerCounts(picker, allSuites.length, 0);
	});

	await step(page, 'Add every filter and check its options', async () => {
		await picker.getByText('Add Filters', { exact: true }).click();
		for (const filter of suiteFilters) {
			const checkbox = picker.getByRole('checkbox', { name: filter, exact: true });
			await expect(checkbox).not.toBeChecked();
			await checkbox.check();
			await expect(checkbox).toBeChecked();
		}
		await closePickerPopover(picker);
		await expect(picker.getByRole('checkbox', { name: suiteFilters[0], exact: true })).toBeHidden();

		for (const filter of suiteFilters) {
			await picker.getByText(filter, { exact: true }).first().click();
			if (filter === 'Last Run Result') {
				for (const result of lastRunResults) {
					await expect(picker.getByRole('checkbox', { name: result, exact: true })).toBeVisible();
				}
			} else if (filter === 'Linked To') {
				await expect(picker.getByRole('checkbox', { name: 'Test Management Tool', exact: true })).toBeVisible();
			} else if (dateFilters.includes(filter)) {
				await expect(picker.getByRole('button', { name: currentMonth(), exact: true })).toBeVisible();
			} else {
				// Test Case, Created By and Labels list their options under a search box.
				await expect(visibleSearchBoxes(picker)).toHaveCount(1);
				await expect(picker.getByRole('checkbox').filter({ visible: true }).nth(1)).toBeVisible();
			}
			await closePickerPopover(picker);
			await expect(visibleSearchBoxes(picker)).toHaveCount(0);
			await expect(picker.getByRole('button', { name: currentMonth(), exact: true })).toHaveCount(0);
		}
	});

	await step(page, 'Filter the available suites by last run result and reset the filter', async () => {
		// The suites have never run, so none of them was last paused.
		await picker.getByText('Last Run Result', { exact: true }).first().click();
		await picker.getByText('Paused', { exact: true }).click();
		await expect(picker.getByRole('checkbox', { name: 'PAUSED', exact: true })).toBeChecked();
		await closePickerPopover(picker);
		await expect(picker.getByText('Last Run Result (1)', { exact: true })).toBeVisible();
		await expectPickerCounts(picker, 0, 0);
		await expect(picker.getByText(noResults, { exact: true })).toBeVisible();
		await picker.getByText('Reset', { exact: true }).click();
		await expect(picker.getByText('Last Run Result (1)', { exact: true })).toHaveCount(0);
		await expectPickerCounts(picker, allSuites.length, 0);
	});

	await step(page, 'Move suites between the lists with Select All, Select and Remove', async () => {
		await selectAll(picker, 'available').check();
		await picker.getByRole('button', { name: 'Select', exact: true }).click();
		await expectPickerCounts(picker, 0, allSuites.length);
		await expect(picker.getByText('All the Test Suites are selected', { exact: true })).toBeVisible();
		await expect(picker.getByRole('button', { name: 'Add to Plan' })).toBeEnabled();

		await tickSuite(picker, readdedSuite);
		await expect(picker.getByRole('button', { name: 'Remove', exact: true })).toBeEnabled();
		await picker.getByRole('button', { name: 'Remove', exact: true }).click();
		await expectPickerCounts(picker, 1, allSuites.length - 1);
		await expect(pickerSuite(picker, readdedSuite)).not.toBeChecked();

		await selectAll(picker, 'available').check();
		await picker.getByRole('button', { name: 'Select', exact: true }).click();
		await expectPickerCounts(picker, 0, allSuites.length);
	});

	await step(page, 'Add every suite to the plan', async () => {
		await picker.getByRole('button', { name: 'Add to Plan' }).click();
		await expect(page.getByText('Add Test Suites to plan', { exact: true })).toBeHidden();
		await expect(main.getByText(`Test Suites (${allSuites.length})`, { exact: true })).toBeVisible();
		for (const suite of allSuites) {
			await expect(main.getByText(suite, { exact: true })).toBeVisible();
		}
	});

	await step(page, 'Search the plan\'s suites', async () => {
		const search = main.getByRole('textbox', { name: 'Search suite' });
		await search.fill(plan.suites[0]);
		await expect(main.getByText(plan.suites[0], { exact: true })).toBeVisible();
		for (const suite of allSuites.filter((name) => name !== plan.suites[0])) {
			await expect(main.getByText(suite, { exact: true })).toBeHidden();
		}
		await search.clear();
		for (const suite of allSuites) {
			await expect(main.getByText(suite, { exact: true })).toBeVisible();
		}
	});

	await step(page, `Remove ${removedSuites.length === 1 ? 'a suite' : `${removedSuites.length} suites`} from the plan`, async () => {
		for (const [index, suite] of removedSuites.entries()) {
			await planSuiteMenu(page, suite).click();
			await expect(page.getByText('Manage Test Case', { exact: true })).toBeVisible();
			await page.getByText('Remove Suite', { exact: true }).click();
			// No machine is linked yet, so the suite can only leave the whole plan.
			const confirm = page.getByRole('dialog').filter({ hasText: 'Remove suite options' });
			await expect(confirm.getByRole('radio', { name: 'Remove from this test machine' })).toBeDisabled();
			await expect(confirm.getByRole('radio', { name: 'Remove from all test machines & test plan' })).toBeChecked();
			await confirm.getByRole('button', { name: 'Remove', exact: true }).click();
			await expect(confirm).toBeHidden();
			await expect(main.getByText(suite, { exact: true })).toHaveCount(0);
			await expect(main.getByText(`Test Suites (${allSuites.length - index - 1})`, { exact: true })).toBeVisible();
		}
	});

	await step(page, `Add ${readdedSuite} back`, async () => {
		const kept = allSuites.length - removedSuites.length;
		await openSuitePicker(page, removedSuites.length, kept);
		// Nothing has changed yet, so there is nothing to add.
		await expect(picker.getByRole('button', { name: 'Add to Plan' })).toBeDisabled();
		for (const suite of plan.suites.filter((name) => name !== readdedSuite)) {
			await expect(pickerSuite(picker, suite)).toBeVisible();
		}
		await tickSuite(picker, readdedSuite);
		await picker.getByRole('button', { name: 'Select', exact: true }).click();
		await expectPickerCounts(picker, removedSuites.length - 1, kept + 1);
		await picker.getByRole('button', { name: 'Add to Plan' }).click();
		await expect(page.getByText('Add Test Suites to plan', { exact: true })).toBeHidden();
	});

	await step(page, 'Check the plan has its suites', async () => {
		await expect(main.getByText(`Test Suites (${plan.suites.length})`, { exact: true })).toBeVisible();
		await expect(main.getByText('Test Machines (0)', { exact: true })).toBeVisible();
		for (const suite of plan.suites) {
			await expect(main.getByText(suite, { exact: true })).toBeVisible();
		}
		for (const suite of extraSuites) {
			await expect(main.getByText(suite, { exact: true })).toHaveCount(0);
		}
	});
}

// Local Devices runs on the user's own machine, so the form stops offering Testsigma's operating systems until
// Testsigma Lab is chosen again. Switching back leaves the form unable to create its profile, so this is only
// done on a form that is then cancelled.
async function switchTestLabs(form: Locator) {
	await form.getByRole('button', { name: /Local Devices$/ }).click();
	await expect(fieldLabel(form, 'OS & Version')).toBeHidden();
	await form.getByRole('button', { name: /Testsigma Lab$/ }).click();
	await expect(fieldLabel(form, 'OS & Version')).toBeVisible();
}

// Checks the options behind the Add Machine form's fields, leaving every field as it was.
async function checkMachineFormFields(page: Page, form: Locator, plan: PlanScenario) {
	const labels = plan.machineForm.labels;
	if (labels.includes('Browser')) {
		// The form does not always start on the same browser, so check that looking at the menu keeps whichever
		// one it shows.
		const browser = dropdown(form, 'Browser');
		await expect(browser).toHaveText(/(Chrome|Firefox|Edge) Latest/, { timeout: 30000 });
		const chosen = (await browser.innerText()).trim();
		await openDropdown(browser);
		for (const name of ['Chrome', 'Firefox', 'Edge']) {
			await expect(form.getByText(name, { exact: true })).toBeVisible();
		}
		// The menu opens upwards over the fields above it, so click the form's title to close it.
		await closeDropdown(browser, form.getByText('Add test machine/device profile', { exact: true }));
		await expect(browser).toHaveText(chosen);
	}
	if (labels.includes('App Source')) {
		await expect(form.getByRole('radio', { name: 'Uploaded apps', exact: true })).toBeChecked();
		await expect(form.getByRole('radio', { name: 'External link', exact: true })).not.toBeChecked();
		// An uploaded app is chosen already, shown after the Uploads label.
		await expect(fieldLabel(form, 'Uploads').locator("xpath=ancestor::div[normalize-space(.) != 'Uploads'][1]")).toHaveText(/^Uploads\s*\*?\s*\S/);
	}
	if (labels.includes('Select backup devices')) {
		await expect(form.getByRole('button', { name: 'Add backup devices' })).toBeEnabled();
	}
	if (labels.includes('Pre-requisites')) {
		await expect(form.getByRole('link', { name: 'View documentation for more pre-requisite settings' })).toHaveAttribute('href', /testsigma\.com\/docs\//);
		await expect(form.getByRole('link', { name: 'Learn how to generate mobile app build with the required configuration' })).toHaveAttribute('href', /testsigma\.com\/docs\//);
	}
	await expect(form.getByText('Desired Capabilities', { exact: true })).toBeVisible();
}

// Picks the first user-defined profile's operating system and resolution and turns on its chosen options.
async function applyMachineChoices(page: Page, form: Locator, choices: MachineChoices) {
	if (choices.os) {
		const os = dropdown(form, 'OS & Version');
		await openDropdown(os);
		await form.getByText(choices.os, { exact: true }).click();
		await expect(os).toContainText(choices.os);
	}
	if (choices.resolution) {
		const resolution = dropdown(form, 'Resolution');
		await openDropdown(resolution);
		await form.getByText(choices.resolution, { exact: true }).click();
		await expect(resolution).toContainText(choices.resolution);
	}
	for (const option of choices.turnOn) {
		await turnOn(form, page, option);
	}
}

export async function linkMachineProfiles(run: PlanRun, plan: PlanScenario) {
	const { page } = run;
	const main = wizard(page);
	const drawer = overlay(page, 'Select test machine profiles', /^Save selections/);
	const saveSelections = drawer.getByRole('button', { name: /^Save selections/ });
	let selected = 0;
	const usedDevices: string[] = [];

	await step(page, 'Open and check the machine profiles drawer', async () => {
		await main.getByRole('button', { name: 'Link Test Machine' }).click();
		await expect(drawer.getByText('User-defined test machine profiles', { exact: true })).toBeVisible({ timeout: 30000 });
		// Only some applications offer ready-made profiles.
		const predefined = drawer.getByText('Pre-defined test machine profiles', { exact: true });
		if (plan.predefinedCatalog.length > 0) {
			await expect(predefined).toBeVisible();
			for (const machine of plan.predefinedCatalog) {
				await expect(drawer.getByText(machine, { exact: true })).toBeVisible();
			}
			// None of them runs a suite of this plan yet.
			await expect(drawer.getByText('No Suites', { exact: true })).toHaveCount(plan.predefinedCatalog.length);
		} else {
			await expect(predefined).toHaveCount(0);
		}
		await expect(drawer.getByRole('button', { name: 'Add Machine' })).toBeEnabled();
		await expect(saveSelections).toHaveText('Save selections(0)');
		await expect(saveSelections).toBeDisabled();
	});

	for (const machine of plan.predefinedMachines) {
		await step(page, `Select the pre-defined ${machine} profile`, async () => {
			await drawer.getByText(machine, { exact: true }).click();
			selected += 1;
			await expect(saveSelections).toHaveText(`Save selections(${selected})`);
			await expect(saveSelections).toBeEnabled();
		});
	}

	const addMachine = overlay(page, 'Add test machine/device profile', 'Create Profile');
	await step(page, 'Switch test labs, then cancel the Add Machine form without creating a profile', async () => {
		await drawer.getByRole('button', { name: 'Add Machine' }).click();
		await addMachine.getByRole('textbox', { name: 'Name', exact: true }).fill(cancelledMachine);
		await switchTestLabs(addMachine);
		await addMachine.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(page.getByText('Add test machine/device profile', { exact: true })).toBeHidden({ timeout: 30000 });
		await expect(drawer.getByText(cancelledMachine, { exact: true })).toHaveCount(0);
		await expect(saveSelections).toHaveText(`Save selections(${selected})`);
	});

	for (const [index, machine] of plan.userDefinedMachines.entries()) {
		await step(page, `Open${index === 0 ? ' and check' : ''} the Add Machine form for ${machine.name}`, async () => {
			await drawer.getByRole('button', { name: 'Add Machine' }).click();
			const name = addMachine.getByRole('textbox', { name: 'Name', exact: true });
			await expect(name).toBeVisible({ timeout: 30000 });
			await expect(name).toBeEmpty();
			// A profile needs a name before it can be created.
			await expect(addMachine.getByRole('button', { name: 'Create Profile' })).toBeDisabled();
			if (index > 0) {
				return;
			}
			for (const label of plan.machineForm.labels) {
				await expect(fieldLabel(addMachine, label)).toBeVisible();
			}
			for (const lab of testLabs) {
				await expect(addMachine.getByRole('button', { name: new RegExp(`${lab}$`) })).toBeVisible();
			}
			for (const option of plan.machineForm.checked) {
				await expect(addMachine.getByRole('checkbox', { name: option, exact: true })).toBeChecked();
			}
			for (const option of plan.machineForm.unchecked) {
				await expect(addMachine.getByRole('checkbox', { name: option, exact: true })).not.toBeChecked();
			}
			// Running suites in parallel is only offered when the plan has more than one suite.
			if (plan.suites.length === 1) {
				await expect(addMachine.getByRole('checkbox', { name: 'Run test suites in parallel', exact: true })).toHaveCount(0);
			}
			await checkMachineFormFields(page, addMachine, plan);
		});

		await step(page, `Create the user-defined ${machine.name} profile`, async () => {
			await addMachine.getByRole('textbox', { name: 'Name', exact: true }).fill(machine.name);
			// Device profiles record their device, so later ones can be put on a different one. The device list
			// loads after the form opens, so wait for it rather than checking whether it is there yet.
			if (plan.machineForm.labels.includes('Device')) {
				await expect(deviceField(addMachine)).toHaveText(/\S/, { timeout: 30000 });
				const device = machine.otherDevice
					? await chooseUnusedDevice(page, addMachine, usedDevices)
					: (await deviceField(addMachine).innerText()).trim();
				usedDevices.push(device);
				test.info().annotations.push({ type: `${machine.name} device`, description: device });
			}
			if (index === 0) {
				await applyMachineChoices(page, addMachine, plan.machineChoices);
			}
			await expect(addMachine.getByRole('button', { name: 'Create Profile' })).toBeEnabled();
			await addMachine.getByRole('button', { name: 'Create Profile' }).click();
			await expect(page.getByText('Add test machine/device profile', { exact: true })).toBeHidden({ timeout: 30000 });
			// The new profile joins the user-defined list already selected.
			await expect(drawer.getByText(machine.name, { exact: true })).toBeVisible();
			selected += 1;
			await expect(saveSelections).toHaveText(`Save selections(${selected})`);
		});
	}

	await step(page, 'Save the selections and check every machine runs every suite', async () => {
		const machines = allMachines(plan);
		await saveSelections.click();
		await expect(page.getByText('Select test machine profiles', { exact: true })).toBeHidden({ timeout: 30000 });
		await expect(main.getByText(`Test Machines (${machines.length})`, { exact: true })).toBeVisible();
		for (const machine of machines) {
			await expect(main.getByText(machine, { exact: true }).first()).toBeVisible();
		}
		await expect(main.getByText(suiteCount(plan.suites.length))).toHaveCount(machines.length);
	});

	await step(page, 'Continue to Test Plan Settings', async () => {
		await main.getByRole('button', { name: 'Continue', exact: true }).click();
		await expect(main.getByRole('checkbox', { name: 'Send Notification', exact: true })).toBeAttached({ timeout: 30000 });
		await expect(main.getByRole('button', { name: 'Create', exact: true })).toBeEnabled();
	});
}

export async function fillPlanSettings(run: PlanRun, plan: PlanScenario) {
	const { page } = run;
	const main = wizard(page);

	await step(page, 'Check the settings and their defaults', async () => {
		await expectWizardSteps(page);
		await expect(main.getByRole('checkbox', { name: 'Send Notification', exact: true })).not.toBeChecked();
		await expect(main.getByText('Additional Settings', { exact: true })).toBeVisible();
		for (const label of ['Environment', 'Screenshot capture', 'Recovery Actions', 'Post Plan Hook', 'Addon', ...(plan.extraSettings ?? [])]) {
			await expect(fieldLabel(main, label)).toBeVisible();
		}
		await expect(main.getByText('For all steps', { exact: true })).toBeVisible();
		await expect(main.getByRole('spinbutton', { name: 'Page Timeout (<=120 secs.)' })).toHaveValue('30');
		await expect(main.getByRole('spinbutton', { name: 'Step Timeout (<=120 secs.)' })).toHaveValue('30');
		await expect(main.getByRole('checkbox', { name: 'Apply to all steps' })).not.toBeChecked();
		await expect(main.getByRole('checkbox', { name: 'Accessibility Testing' })).not.toBeChecked();
		await expect(main.getByRole('link', { name: 'WCAG guidelines' })).toHaveAttribute('href', 'https://www.w3.org/standards/about/');
		// Recipients only appear once notifications are on.
		await expect(main.getByRole('textbox', { name: 'Add Email' })).toHaveCount(0);
	});

	await step(page, 'Turn on notifications', async () => {
		await turnOn(main, page, 'Send Notification');
		await expect(main.getByText('Notify On', { exact: true })).toBeVisible();
		for (const status of notificationStatuses) {
			await expect(main.getByText(status, { exact: true })).toBeVisible();
		}
	});

	await step(page, `Notify on ${plan.notifyOn.join(' and ')} runs`, async () => {
		for (const status of plan.notifyOn) {
			const chip = main.getByText(status, { exact: true });
			// A chosen status is highlighted; click only the ones not chosen yet.
			if (!/bg-primary-50/.test((await chip.getAttribute('class')) ?? '')) {
				await chip.click();
			}
			await expect(chip).toHaveClass(/bg-primary-50/);
		}
		await expect(main.getByText('Send Notification to', { exact: true })).toBeVisible();
		await expect(main.getByRole('checkbox', { name: 'Add my email' })).toBeAttached();
		await expect(main.getByRole('link', { name: 'Open chat integrations' })).toHaveAttribute('href', '/ui/settings/plugs');
	});

	await step(page, 'An invalid email address is not added', async () => {
		const email = main.getByRole('textbox', { name: 'Add Email' });
		await email.fill(invalidEmail);
		await email.press('Enter');
		// Enter only turns a valid address into a chip; anything else stays in the box.
		await expect(email).toHaveValue(invalidEmail);
		await email.clear();
		await expect(main.getByText(invalidEmail, { exact: true })).toHaveCount(0);
	});

	await step(page, `Add ${plan.notificationEmail} as a recipient`, async () => {
		const email = main.getByRole('textbox', { name: 'Add Email' });
		await email.fill(plan.notificationEmail);
		await email.press('Enter');
		// The address becomes a chip and the box clears for the next one.
		await expect(email).toBeEmpty();
		await expect(main.getByText(plan.notificationEmail, { exact: true })).toBeVisible();
	});

	await step(page, 'Add my email as a recipient', async () => {
		await turnOn(main, page, 'Add my email');
		await expect(main.getByText(accountEmail(), { exact: true })).toBeVisible();
		await expect(main.getByText(plan.notificationEmail, { exact: true })).toBeVisible();
	});

	await step(page, 'Choose an environment', async () => {
		const environment = dropdown(main, 'Environment');
		await expect(environment).toHaveText('None');
		await openDropdown(environment);
		const options = (await main.getByRole('gridcell').filter({ visible: true }).allInnerTexts()).map((text) => text.trim());
		expect(options[0]).toBe('None');
		// Environments belong to the project, which may have none besides "None".
		run.environment = options.find((option) => option && option !== 'None');
		if (!run.environment) {
			test.info().annotations.push({ type: 'environment', description: 'The project has no environments to choose.' });
			await closeDropdown(environment, main.getByText('Additional Settings', { exact: true }));
			return;
		}
		await main.getByRole('gridcell', { name: run.environment, exact: true }).click();
		await expect(environment).toHaveText(run.environment);
	});

	await step(page, 'Capture screenshots only for failed steps', async () => {
		const screenshots = dropdown(main, 'Screenshot capture');
		await openDropdown(screenshots);
		for (const option of screenshotOptions) {
			await expect(main.getByText(option, { exact: true }).last()).toBeVisible();
		}
		await main.getByText('Only for failed Steps', { exact: true }).click();
		await expect(screenshots).toHaveText('Only for failed Steps');
	});

	await step(page, 'Timeouts over 120 seconds are refused', async () => {
		for (const name of ['Page Timeout', 'Step Timeout']) {
			const timeout = main.getByRole('spinbutton', { name: `${name} (<=120 secs.)` });
			await timeout.fill(timeouts.tooLong);
			await timeout.blur();
			await expect(main.getByText(`${name} should be less than or equal to 120`, { exact: true })).toBeVisible();
		}
	});

	await step(page, `Set the page timeout to ${timeouts.page} and the step timeout to ${timeouts.step} seconds`, async () => {
		for (const [name, value] of [['Page Timeout', timeouts.page], ['Step Timeout', timeouts.step]]) {
			const timeout = main.getByRole('spinbutton', { name: `${name} (<=120 secs.)` });
			await timeout.fill(value);
			await timeout.blur();
			await expect(timeout).toHaveValue(value);
			await expect(main.getByText(`${name} should be less than or equal to 120`, { exact: true })).toHaveCount(0);
		}
		await turnOn(main, page, 'Apply to all steps');
	});

	await step(page, 'Turn on accessibility testing', async () => {
		await expect(main.getByText('WCAG Version & Conformance Level', { exact: true })).toHaveCount(0);
		await turnOn(main, page, 'Accessibility Testing');
		await expect(main.getByText('WCAG Version & Conformance Level', { exact: true })).toBeVisible();
		await expect(main.getByText('WCAG 2.1 AA', { exact: true })).toBeVisible();
	});

	await step(page, 'Change every recovery action', async () => {
		// The actions stay folded away until their heading is clicked.
		await expect(main.getByRole('row').filter({ hasText: recoveryActions[0].when })).toHaveCount(0);
		await main.getByText('Recovery Actions', { exact: true }).click();
		for (const { when, choices: [byDefault, other] } of recoveryActions) {
			const row = main.getByRole('row').filter({ hasText: when });
			await expect(row.getByRole('radio', { name: byDefault, exact: true })).toBeChecked();
			await expect(row.getByRole('radio', { name: other, exact: true })).not.toBeChecked();
			await choose(row, other);
			await expect(row.getByRole('radio', { name: byDefault, exact: true })).not.toBeChecked();
		}
		const rerun = main.getByRole('row').filter({ hasText: 'Rerun on failure' });
		await expect(rerun.getByRole('radio', { name: rerunChoices[0], exact: true })).toBeChecked();
		for (const choice of rerunChoices.slice(1)) {
			await expect(rerun.getByRole('radio', { name: choice, exact: true })).not.toBeChecked();
		}
		await choose(rerun, 'Only Failed Test Cases');
	});

	await step(page, 'Check the post plan hook offers no addon', async () => {
		const addon = dropdown(main, 'Addon');
		await expect(addon).toHaveText('None');
		await openDropdown(addon);
		await expect(main.getByText('None', { exact: true }).last()).toBeVisible();
		await closeDropdown(addon, main.getByText('Post Plan Hook', { exact: true }));
		await expect(addon).toHaveText('None');
	});
}

// The signed-in account's address, which "Add my email" adds.
function accountEmail() {
	return process.env.TESTSIGMA_EMAIL!;
}

export async function createPlan(run: PlanRun, plan: PlanScenario) {
	const { page, versionId } = run;
	const main = wizard(page);
	const machineNames = allMachines(plan);

	await step(page, 'Create the plan and check the saved details', async () => {
		const createResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/executions$/.test(new URL(response.url()).pathname));
		await main.getByRole('button', { name: 'Create', exact: true }).click();
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
		expect(saved.mailList.split(',').map((email: string) => email.trim()).sort()).toEqual([plan.notificationEmail, accountEmail()].sort());
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
		await expect(page).toHaveURL(new RegExp(`/plans/${run.planId}/details$`), { timeout: 30000 });
		await expect(main.getByText(plan.name, { exact: true }).first()).toBeVisible({ timeout: 30000 });
		for (const control of ['Edit', 'Delete']) {
			await expect(main.getByRole('button', { name: control, exact: true })).toBeVisible();
		}
		await expect(main.getByRole('link', { name: 'View Reports' })).toHaveAttribute('href', new RegExp(`/plans/${run.planId}/details$`));
		for (const machine of machineNames) {
			const row = main.getByRole('grid').getByRole('gridcell', { name: new RegExp(`${machine}$`) }).first();
			await expect(row).toBeVisible();
			await expect(row.getByRole('checkbox')).toBeChecked();
		}
	});

	await step(page, 'Check every machine runs every suite', async () => {
		const machines = await listPlanMachines(page, run.planId);
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
		expect((await listPlans(page, versionId)).filter((item) => item.name === plan.name)).toHaveLength(1);
	});
}

export async function verifyPlanInList(run: PlanRun, plan: PlanScenario) {
	const { page, versionId } = run;
	const main = wizard(page);
	const search = main.getByRole('textbox', { name: 'Search' });
	const plans = await listPlans(page, versionId);

	await step(page, 'Open Test Plans', async () => {
		await hoverNavigation(page, 300);
		await page.getByRole('link', { name: 'Test Plans', exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`/td/${versionId}/plans$`), { timeout: 30000 });
		await expect(main.getByText(`All (${plans.length})`, { exact: true })).toBeVisible({ timeout: 30000 });
		for (const column of ['Name', 'Test Plan Type', 'Test Lab & Test Machines', 'Actions']) {
			await expect(main.getByText(column, { exact: true })).toBeVisible();
		}
	});

	await step(page, 'Search for the plan', async () => {
		await search.fill(plan.name);
		await expect(main.getByText('Filtered (1)', { exact: true })).toBeVisible({ timeout: 30000 });
		const row = main.getByRole('grid').getByRole('row', { name: `${plan.name} - Cross Browser` }).last();
		await expect(row.getByRole('link', { name: plan.name, exact: true })).toHaveAttribute('href', `/ui/td/plans/${run.planId}/details`);
		await expect(row.getByRole('gridcell', { name: 'Cross Browser', exact: true })).toBeVisible();
		for (const action of ['Schedule', 'Reports', 'Run']) {
			await expect(row.getByText(action, { exact: true })).toBeVisible();
		}
	});

	await step(page, 'Search for a plan that does not exist', async () => {
		await search.fill('zz-no-such-plan');
		await expect(main.getByText('Filtered (0)', { exact: true })).toBeVisible({ timeout: 30000 });
		await expect(main.getByText(noResults, { exact: true })).toBeVisible();
		await expect(main.getByRole('img', { name: 'Empty state illustration' })).toBeVisible();
		await search.clear();
		await expect(main.getByText(/^Filtered \(\d+\)$/)).toHaveCount(0);
		await expect(main.getByRole('link', { name: plan.name, exact: true })).toBeVisible();
	});

	await step(page, 'Show and hide the filters', async () => {
		await main.getByText('Show Filters', { exact: true }).click();
		await expect(main.getByText('Hide Filters', { exact: true })).toBeVisible();
		await expect(main.getByText('Add Filter', { exact: true })).toBeVisible();
		await main.getByText('Hide Filters', { exact: true }).click();
		await expect(main.getByText('Show Filters', { exact: true })).toBeVisible();
		await expect(main.getByText('Add Filter', { exact: true })).toHaveCount(0);
	});

	await step(page, 'Check the sort options', async () => {
		await main.getByText('Sort by', { exact: true }).click();
		for (const option of sortOptions) {
			await expect(main.getByText(option, { exact: true }).last()).toBeVisible();
		}
		await page.keyboard.press('Escape');
	});
}
