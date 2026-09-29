/**
 * Steps shared by the "Create test plan" specs under Test Plan Module. Each application of the
 * "[9.0.8] Accessibility" project has its own spec, which declares the tests, describes its plan as a
 * PlanScenario and runs these steps for it.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { hoverNavigation, type SuiteApplication } from './create-test-suites';

// A user-defined machine profile; otherDevice puts it on a device no earlier profile of the plan uses.
export type UserDefinedMachine = { name: string; otherDevice?: boolean };

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
	notifyOn: string[];
	notificationEmail: string;
};

// What one run of the scenario learns along the way.
export type PlanRun = { page: Page; versionId: number; suiteIds: Map<string, number>; planId: number };

type Plan = { id: number; name: string };
type PlanMachine = { id: number; title: string; suiteIds: number[]; isPredefined: boolean; platformDeviceId: string | null };

const wizardSteps = ['Basic Details', 'Add Test Suites & Link Machine Profiles', 'Test Plan Settings'];
const testLabs = ['Testsigma Lab', 'Local Devices', 'Lambda Test', 'Sauce Labs', 'BrowserStack'];
const notificationStatuses = ['Passed', 'Failed', 'Not Executed', 'Queued', 'Stopped', 'Running'];

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
		await scope.locator('label').filter({ has: page.getByRole('checkbox', { name, exact: true }) }).click();
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
	});

	await step(page, 'Add the labels', async () => {
		await addMissingLabels(page, plan);
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

export async function addTestSuites(run: PlanRun, plan: PlanScenario) {
	const { page } = run;
	const main = wizard(page);

	await step(page, 'Check the empty suites list', async () => {
		await expect(main.getByText('No Test Suite has been added to this plan', { exact: true })).toBeVisible();
		await expect(main.getByRole('img', { name: 'No test suites added illustration' })).toBeVisible();
		await expect(main.getByRole('button', { name: 'Add Test Suites' })).toBeEnabled();
	});

	const modal = overlay(page, 'Add Test Suites to plan', 'Add to Plan');
	await step(page, 'Open and check the Add Test Suites picker', async () => {
		await main.getByRole('button', { name: 'Add Test Suites' }).click();
		await expect(modal.getByText(/^Available Test Suites \(\d+\)$/)).toBeVisible({ timeout: 30000 });
		await expect(modal.getByText('Add Filters', { exact: true })).toBeVisible();
		await expect(modal.getByText('Selected for Test plan (0)', { exact: true })).toBeVisible();
		await expect(modal.getByText('No Test Suite has been added to this plan', { exact: true })).toBeVisible();
		await expect(modal.getByRole('button', { name: 'Select', exact: true })).toBeDisabled();
		await expect(modal.getByRole('button', { name: 'Remove', exact: true })).toBeDisabled();
		await expect(modal.getByRole('button', { name: 'Add to Plan' })).toBeDisabled();
		await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
	});

	await step(page, `Select ${plan.suites.length === 1 ? 'the suite' : `the ${plan.suites.length} suites`}`, async () => {
		for (const suite of plan.suites) {
			// "Select All" would also match "Select All test cases…", so match each name exactly.
			const checkbox = modal.getByRole('checkbox', { name: `Select ${suite}`, exact: true }).first();
			await expect(checkbox).toBeVisible();
			await checkbox.check();
			await expect(checkbox).toBeChecked();
		}
		await modal.getByRole('button', { name: 'Select', exact: true }).click();
		await expect(modal.getByText(`Selected for Test plan (${plan.suites.length})`, { exact: true })).toBeVisible();
		await expect(modal.getByRole('button', { name: 'Add to Plan' })).toBeEnabled();
		await modal.getByRole('button', { name: 'Add to Plan' }).click();
		await expect(page.getByText('Add Test Suites to plan', { exact: true })).toBeHidden();
	});

	await step(page, 'Check the suites were added', async () => {
		await expect(main.getByText(`Test Suites (${plan.suites.length})`, { exact: true })).toBeVisible();
		await expect(main.getByText('Test Machines (0)', { exact: true })).toBeVisible();
		await expect(main.getByRole('textbox', { name: 'Search suite' })).toBeVisible();
		for (const suite of plan.suites) {
			await expect(main.getByText(suite, { exact: true })).toBeVisible();
		}
	});
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
		for (const label of ['Environment', 'Screenshot capture', 'Recovery Actions', 'Post Plan Hook', 'Addon']) {
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

	await step(page, `Add ${plan.notificationEmail} as a recipient`, async () => {
		const email = main.getByRole('textbox', { name: 'Add Email' });
		await email.fill(plan.notificationEmail);
		await email.press('Enter');
		// The address becomes a chip and the box clears for the next one.
		await expect(email).toBeEmpty();
		await expect(main.getByText(plan.notificationEmail, { exact: true })).toBeVisible();
	});
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
			mailList: plan.notificationEmail,
		});
		expect([...saved.notificationStatusList].sort()).toEqual(statusCodes);
		expect([...saved.tags].sort()).toEqual([...plan.labels].sort());
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
		// Profiles asked to use another device run on a device of their own.
		if (plan.userDefinedMachines.some((machine) => machine.otherDevice)) {
			const devices = machines.map((machine) => machine.platformDeviceId);
			expect(new Set(devices).size, `devices ${devices.join(', ')}`).toBe(machines.length);
		}
		expect((await listPlans(page, versionId)).filter((item) => item.name === plan.name)).toHaveLength(1);
	});
}
