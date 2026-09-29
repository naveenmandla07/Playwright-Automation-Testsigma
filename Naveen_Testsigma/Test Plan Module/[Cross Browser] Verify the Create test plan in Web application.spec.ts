/**
 * Creating a cross browser test plan for the web application of the "[9.0.8] Accessibility" project.
 *
 * Scenarios (run in order, sharing one signed-in page and one Create Test Plan wizard):
 * - Switch to the "[9.0.8] Accessibility" project, its "Web App" application and version "1".
 * - Open the Test Plans module and check its page.
 * - Basic Details: check the step, choose "Cross browser testing" and enter the name, description and labels.
 * - Add Test Suites: add the two suites created by the web test suite spec.
 * - Link Machine Profiles: link the pre-defined "Windows Chrome" profile and a new user-defined profile.
 * - Test Plan Settings: turn on notifications for passed and failed runs, sent to naveen.mandla@testsigma.com.
 * - Create the test plan and check what was saved.
 *
 * Needs the suites from "Verify the Create test suites in web application.spec.ts". The plan is kept after the
 * run so it can be reviewed; a run first deletes a plan left with the same name by an earlier run. Runs in the
 * serial chromium-projects project because it changes the account's current project.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
	hoverNavigation,
	openSignedInPage,
	projectName,
	suiteNames,
	switchToApplication,
	versionName,
	type SuiteApplication,
} from '../support/create-test-suites';

const application: SuiteApplication = { name: 'Web App', type: 'WebApplication' };

const planName = 'Cross browser test plan for Web App';
const planDescription = 'Cross browser test plan created by the Testsigma Playwright automation suite.';
const planLabels = ['cross-browser', 'web-app'];
const planSuites = [suiteNames.allCases, suiteNames.randomCases];
const predefinedMachines = ['Windows Firefox', 'Windows Chrome', 'Mac Chrome', 'Windows Edge', 'Mac Safari'];
const predefinedMachine = 'Windows Chrome';
const userDefinedMachine = 'User-defined Web Machine';
const notifyOn = ['Passed', 'Failed'];
const notificationEmail = 'naveen.mandla@testsigma.com';
const wizardSteps = ['Basic Details', 'Add Test Suites & Link Machine Profiles', 'Test Plan Settings'];

type Plan = { id: number; name: string };
type PlanMachine = { id: number; title: string; suiteIds: number[]; isPredefined: boolean };

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

async function expectWizardSteps(page: Page) {
	for (const [index, label] of wizardSteps.entries()) {
		await expect(wizard(page).getByText(label, { exact: true })).toBeVisible();
		await expect(wizard(page).getByText(String(index + 1), { exact: true }).first()).toBeVisible();
	}
}

// Fills in the name and description, leaving any that already hold the right value alone.
async function enterNameAndDescription(page: Page) {
	const main = wizard(page);
	const name = main.getByRole('textbox', { name: 'Name', exact: true });
	if ((await name.inputValue()) !== planName) {
		await name.fill(planName);
	}
	await expect(name).toHaveValue(planName);

	await turnOn(main, page, 'Description');
	const description = main.getByRole('textbox', { name: 'Description', exact: true });
	await expect(description).toBeEditable();
	if ((await description.inputValue()) !== planDescription) {
		await description.clear();
		await description.pressSequentially(planDescription);
		await description.blur();
	}
	await expect(description).toHaveValue(planDescription);
}

// Turning the description on can clear the form's own copy of it a moment later while the box keeps showing
// the text, so the plan would be saved without it. An edit made once the form has settled hands the form the
// full text again.
async function commitDescription(page: Page) {
	const description = wizard(page).getByRole('textbox', { name: 'Description', exact: true });
	await description.click();
	await description.press('End');
	await description.press('Space');
	await description.press('Backspace');
	await description.blur();
	await expect(description).toHaveValue(planDescription);
}

function labelChip(page: Page, label: string) {
	return wizard(page).getByText(label, { exact: true });
}

// Each label is added by typing it and pressing Enter, which turns it into a chip and clears the box.
async function addMissingLabels(page: Page) {
	const labels = wizard(page).getByRole('textbox', { name: 'Labels', exact: true });
	for (const label of planLabels) {
		if (await labelChip(page, label).isVisible()) {
			continue;
		}
		await labels.fill(label);
		await labels.press('Enter');
		await expect(labels).toBeEmpty();
		await expect(labelChip(page, label)).toBeVisible();
	}
}

test.describe('Verify the Create test plan in Web application', () => {
	test.describe.configure({ mode: 'serial', timeout: 240000 });
	test.skip(!process.env.TESTSIGMA_EMAIL || !process.env.TESTSIGMA_PASSWORD, 'Set TESTSIGMA_EMAIL and TESTSIGMA_PASSWORD in .env to run this test.');

	let page: Page;
	let versionId: number;
	let suiteIds: Map<string, number>;

	test.beforeAll(async ({ browser }) => {
		({ page, versionId } = await openSignedInPage(browser, application));
	});

	test.afterAll(async () => {
		await page.close();
	});

	test(`Switch to the ${projectName} project, ${application.name} and version ${versionName}`, async () => {
		await switchToApplication(page, application, versionId);
	});

	test('Verify the Test Plans page', async () => {
		await step(page, 'Check the suites the plan needs', async () => {
			suiteIds = await suiteIdsByName(page, versionId);
			for (const suite of planSuites) {
				expect(suiteIds.has(suite), `Suite "${suite}" is missing; run the web test suite spec first`).toBe(true);
			}
		});

		await step(page, 'Remove a plan left by an earlier run', async () => {
			for (const plan of (await listPlans(page, versionId)).filter((item) => item.name === planName)) {
				expect((await page.request.delete(`/executions/${plan.id}`)).ok()).toBe(true);
			}
			await expect.poll(async () => (await listPlans(page, versionId)).some((plan) => plan.name === planName)).toBe(false);
		});

		await step(page, 'Open Test Plans', async () => {
			await hoverNavigation(page, 300);
			await page.getByRole('link', { name: 'Test Plans', exact: true }).click();
			await expect(page).toHaveURL(new RegExp(`/td/${versionId}/plans$`), { timeout: 30000 });
			const main = page.locator('main');
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
	});

	test('Basic Details: choose Cross browser testing and enter the name, description and labels', async () => {
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
			await expect(main.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
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
			await enterNameAndDescription(page);
		});

		await step(page, 'Add the labels', async () => {
			await addMissingLabels(page);
		});

		await step(page, 'Continue to Add Test Suites', async () => {
			// Everything entered must still be in place before leaving the step; put back anything that was lost.
			await expect(async () => {
				await enterNameAndDescription(page);
				await addMissingLabels(page);
				await expect(main.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(planName, { timeout: 2000 });
				await expect(main.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue(planDescription, { timeout: 2000 });
				for (const label of planLabels) {
					await expect(labelChip(page, label)).toBeVisible({ timeout: 2000 });
				}
			}).toPass({ timeout: 45000 });
			await commitDescription(page);
			await main.getByRole('button', { name: 'Continue', exact: true }).click();
			await expect(main.getByText(/^Test Suites \(0\)/).first()).toBeVisible({ timeout: 30000 });
		});
	});

	test('Add Test Suites: add both web test suites', async () => {
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

		await step(page, 'Select the two suites', async () => {
			for (const suite of planSuites) {
				// "Select All" would also match "Select All test cases…", so match each name exactly.
				const checkbox = modal.getByRole('checkbox', { name: `Select ${suite}`, exact: true }).first();
				await expect(checkbox).toBeVisible();
				await checkbox.check();
				await expect(checkbox).toBeChecked();
			}
			await modal.getByRole('button', { name: 'Select', exact: true }).click();
			await expect(modal.getByText(`Selected for Test plan (${planSuites.length})`, { exact: true })).toBeVisible();
			await expect(modal.getByRole('button', { name: 'Add to Plan' })).toBeEnabled();
			await modal.getByRole('button', { name: 'Add to Plan' }).click();
			await expect(page.getByText('Add Test Suites to plan', { exact: true })).toBeHidden();
		});

		await step(page, 'Check the suites were added', async () => {
			await expect(main.getByText(`Test Suites (${planSuites.length})`, { exact: true })).toBeVisible();
			await expect(main.getByText('Test Machines (0)', { exact: true })).toBeVisible();
			await expect(main.getByRole('textbox', { name: 'Search suite' })).toBeVisible();
			for (const suite of planSuites) {
				await expect(main.getByText(suite, { exact: true })).toBeVisible();
			}
		});
	});

	test('Link Machine Profiles: one pre-defined and one user-defined test machine', async () => {
		const main = wizard(page);
		const drawer = overlay(page, 'Select test machine profiles', /^Save selections/);
		const saveSelections = drawer.getByRole('button', { name: /^Save selections/ });

		await step(page, 'Open and check the machine profiles drawer', async () => {
			await main.getByRole('button', { name: 'Link Test Machine' }).click();
			await expect(drawer.getByText('Pre-defined test machine profiles', { exact: true })).toBeVisible({ timeout: 30000 });
			await expect(drawer.getByText('User-defined test machine profiles', { exact: true })).toBeVisible();
			for (const machine of predefinedMachines) {
				await expect(drawer.getByText(machine, { exact: true })).toBeVisible();
			}
			await expect(drawer.getByRole('button', { name: 'Add Machine' })).toBeEnabled();
			await expect(saveSelections).toHaveText('Save selections(0)');
			await expect(saveSelections).toBeDisabled();
		});

		await step(page, `Select the pre-defined ${predefinedMachine} profile`, async () => {
			await drawer.getByText(predefinedMachine, { exact: true }).click();
			await expect(saveSelections).toHaveText('Save selections(1)');
			await expect(saveSelections).toBeEnabled();
		});

		const addMachine = overlay(page, 'Add test machine/device profile', 'Create Profile');
		await step(page, 'Open and check the Add Machine form', async () => {
			await drawer.getByRole('button', { name: 'Add Machine' }).click();
			await expect(addMachine.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible({ timeout: 30000 });
			await expect(addMachine.getByRole('textbox', { name: 'Name', exact: true })).toBeEmpty();
			for (const label of ['Pre-requisite test machine', 'Test Lab', 'Test Machine', 'OS & Version', 'Browser', 'Resolution', 'Parallel Settings']) {
				await expect(addMachine.getByText(new RegExp(`^${label.replace(/[&]/g, '\\$&')}\\s*\\*?$`)).first()).toBeVisible();
			}
			for (const lab of ['Testsigma Lab', 'Local Devices', 'Lambda Test', 'Sauce Labs', 'BrowserStack']) {
				await expect(addMachine.getByRole('button', { name: new RegExp(`${lab}$`) })).toBeVisible();
			}
			await expect(addMachine.getByRole('checkbox', { name: 'Headless Test' })).not.toBeChecked();
			await expect(addMachine.getByRole('checkbox', { name: 'Run test suites in parallel' })).toBeChecked();
			await expect(addMachine.getByRole('checkbox', { name: 'Reset session for every test case' })).toBeChecked();
			// A profile needs a name before it can be created.
			await expect(addMachine.getByRole('button', { name: 'Create Profile' })).toBeDisabled();
		});

		await step(page, `Create the user-defined ${userDefinedMachine} profile`, async () => {
			await addMachine.getByRole('textbox', { name: 'Name', exact: true }).fill(userDefinedMachine);
			await expect(addMachine.getByRole('button', { name: 'Create Profile' })).toBeEnabled();
			await addMachine.getByRole('button', { name: 'Create Profile' }).click();
			await expect(page.getByText('Add test machine/device profile', { exact: true })).toBeHidden({ timeout: 30000 });
			// The new profile joins the user-defined list already selected, next to the pre-defined one.
			await expect(drawer.getByText(userDefinedMachine, { exact: true })).toBeVisible();
			await expect(saveSelections).toHaveText('Save selections(2)');
		});

		await step(page, 'Save the selections and check both machines run both suites', async () => {
			await saveSelections.click();
			await expect(page.getByText('Select test machine profiles', { exact: true })).toBeHidden({ timeout: 30000 });
			await expect(main.getByText('Test Machines (2)', { exact: true })).toBeVisible();
			for (const machine of [predefinedMachine, userDefinedMachine]) {
				await expect(main.getByText(machine, { exact: true }).first()).toBeVisible();
			}
			await expect(main.getByText(`${planSuites.length} Suites`, { exact: true })).toHaveCount(2);
		});

		await step(page, 'Continue to Test Plan Settings', async () => {
			await main.getByRole('button', { name: 'Continue', exact: true }).click();
			await expect(main.getByRole('checkbox', { name: 'Send Notification', exact: true })).toBeAttached({ timeout: 30000 });
			await expect(main.getByRole('button', { name: 'Create', exact: true })).toBeEnabled();
		});
	});

	test(`Test Plan Settings: send notifications to ${notificationEmail}`, async () => {
		const main = wizard(page);

		await step(page, 'Check the settings and their defaults', async () => {
			await expectWizardSteps(page);
			await expect(main.getByRole('checkbox', { name: 'Send Notification', exact: true })).not.toBeChecked();
			await expect(main.getByText('Additional Settings', { exact: true })).toBeVisible();
			for (const label of ['Environment', 'Screenshot capture', 'Recovery Actions', 'Post Plan Hook', 'Addon']) {
				await expect(main.getByText(new RegExp(`^${label}\\s*\\*?$`)).first()).toBeVisible();
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
			for (const status of ['Passed', 'Failed', 'Not Executed', 'Queued', 'Stopped', 'Running']) {
				await expect(main.getByText(status, { exact: true })).toBeVisible();
			}
		});

		await step(page, `Notify on ${notifyOn.join(' and ')} runs`, async () => {
			for (const status of notifyOn) {
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

		await step(page, `Add ${notificationEmail} as a recipient`, async () => {
			const email = main.getByRole('textbox', { name: 'Add Email' });
			await email.fill(notificationEmail);
			await email.press('Enter');
			// The address becomes a chip and the box clears for the next one.
			await expect(email).toBeEmpty();
			await expect(main.getByText(notificationEmail, { exact: true })).toBeVisible();
		});
	});

	test('Create the test plan', async () => {
		const main = wizard(page);
		let planId = 0;

		await step(page, 'Create the plan and check the saved details', async () => {
			const createResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/executions$/.test(new URL(response.url()).pathname));
			await main.getByRole('button', { name: 'Create', exact: true }).click();
			const response = await createResponse;
			expect(response.status()).toBe(201);
			expect(response.request().postDataJSON()).toMatchObject({ name: planName, description: planDescription });
			const plan = await response.json();
			planId = plan.id;
			expect(plan).toMatchObject({
				name: planName,
				description: planDescription,
				applicationVersionId: versionId,
				executionType: 'CROSS_BROWSER',
				mailList: notificationEmail,
				notificationStatusList: ['0', '1'],
			});
			expect([...plan.tags].sort()).toEqual([...planLabels].sort());
		});

		await step(page, 'Check the plan details page', async () => {
			await expect(page).toHaveURL(new RegExp(`/plans/${planId}/details$`), { timeout: 30000 });
			await expect(main.getByText(planName, { exact: true }).first()).toBeVisible({ timeout: 30000 });
			for (const control of ['Edit', 'Delete']) {
				await expect(main.getByRole('button', { name: control, exact: true })).toBeVisible();
			}
			await expect(main.getByRole('link', { name: 'View Reports' })).toHaveAttribute('href', new RegExp(`/plans/${planId}/details$`));
			for (const machine of [predefinedMachine, userDefinedMachine]) {
				const row = main.getByRole('grid').getByRole('gridcell', { name: new RegExp(`${machine}$`) }).first();
				await expect(row).toBeVisible();
				await expect(row.getByRole('checkbox')).toBeChecked();
			}
		});

		await step(page, 'Check both machines run both suites', async () => {
			const machines = await listPlanMachines(page, planId);
			expect(machines.map((machine) => machine.title).sort()).toEqual([predefinedMachine, userDefinedMachine].sort());
			const expectedSuiteIds = planSuites.map((suite) => suiteIds.get(suite)!).sort();
			for (const machine of machines) {
				expect([...machine.suiteIds].sort(), `suites of ${machine.title}`).toEqual(expectedSuiteIds);
			}
			expect(machines.find((machine) => machine.title === predefinedMachine)?.isPredefined).toBe(true);
			expect(machines.find((machine) => machine.title === userDefinedMachine)?.isPredefined).toBe(false);
			expect((await listPlans(page, versionId)).filter((plan) => plan.name === planName)).toHaveLength(1);
		});
	});
});
