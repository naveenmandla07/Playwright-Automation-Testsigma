/**
 * The Audit Logs tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Audit Logs tab and check its elements.
 * - Check every entry listed: when it happened, its event type and action, its project, who did it, and a way to
 *   see its details.
 * - Open an entry's details and close them.
 * - Open the filters and check each of them: event types, actions, a date range, users and projects, then cancel.
 * - Filter the log to sign-ins, which the check itself made by signing in, and clear the filter.
 *
 * Only looks: "Export" is checked but never clicked, since it would start an export of the log. The log belongs
 * to the account, so entries are checked for what every entry shows.
 */
import { expect, test, type Locator } from '@playwright/test';
import { expectTabElements, openTab, reopenTab, useSettingsTab } from '../../support/admin-settings';
import { projectName } from '../../support/create-test-suites';

const eventTypes = ['Test Case', 'Element', 'Test Plan', 'Test Suite', 'Test Data', 'Environment', 'Variable', 'Authentication', 'Access Bridge'];
const actions = ['Create', 'Update', 'Delete', 'Login', 'Logout'];
const filterSections = ['Event Type', 'Action', 'Date Range', 'User', 'Project'];
// When an entry happened, e.g. "Sep 30, 2026, 03:15 PM".
const when = /^\w{3} \d{1,2}, \d{4}, \d{1,2}:\d{2} (AM|PM)$/;

// Each entry is a row inside the grid's own wrapping row.
function entryRows(main: Locator) {
	return main.getByRole('grid').getByRole('row').getByRole('row');
}

// An entry's lines: when, event type, action, project, then who did it and what happened.
async function entryLines(row: Locator) {
	return (await row.innerText()).split('\n').map((line) => line.trim()).filter(Boolean);
}

test.describe('Verify the Audit Logs', () => {
	const run = useSettingsTab('Audit Logs');

	function filters() {
		return run.page.locator('div')
			.filter({ has: run.page.getByRole('heading', { name: 'Filters' }) })
			.filter({ has: run.page.getByRole('button', { name: 'Apply' }) })
			.last();
	}

	async function openFilters() {
		await run.main.getByRole('button', { name: 'Filters', exact: true }).click();
		await expect(filters().getByRole('heading', { name: 'Filters' })).toBeVisible();
	}

	// A filter's choices are folded away until its name is clicked.
	async function openSection(name: string) {
		await filters().getByText(name, { exact: true }).click();
	}

	test('Open the Audit Logs tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
	});

	test('Check every entry listed', async () => {
		const rows = entryRows(run.main);
		await expect(rows.first()).toBeVisible();
		const count = await rows.count();
		test.info().annotations.push({ type: 'entries', description: `${count} entries shown` });
		for (let index = 0; index < count; index += 1) {
			const lines = await entryLines(rows.nth(index));
			const label = `entry ${index + 1}`;
			expect.soft(lines[0], `${label} time`).toMatch(when);
			expect.soft(eventTypes, `${label} event type`).toContain(lines[1]);
			expect.soft(actions, `${label} action`).toContain(lines[2]);
			// The project, application and version the entry concerns, or "-" when it concerns none.
			expect.soft(lines[3], `${label} project`).toMatch(/\S/);
			expect.soft(lines.at(-1), `${label} details`).toBe('View Details');
		}
	});

	test('Open an entry\'s details', async () => {
		const lines = await entryLines(entryRows(run.main).first());
		await entryRows(run.main).first().getByText('View Details').click();
		const details = run.page.getByRole('dialog');
		await expect(details.getByText('Detailed View', { exact: true })).toBeVisible();
		// The details repeat who did it and what happened.
		const [, , , , , who] = lines;
		await expect.soft(details.getByText(who, { exact: true }).first(), 'who').toBeVisible();
		await expect.soft(details.getByText(lines.at(-2)!, { exact: true }).first(), 'what happened').toBeVisible();
		await details.getByRole('button', { name: 'Close', exact: true }).click();
		await expect(details).toHaveCount(0);
	});

	test('Open the filters and check each of them', async () => {
		await openFilters();
		const panel = filters();
		for (const section of filterSections) {
			await expect.soft(panel.getByText(section, { exact: true }), section).toBeVisible();
		}
		for (const name of ['Clear all', 'Cancel', 'Apply']) {
			await expect.soft(panel.getByRole('button', { name, exact: true }), name).toBeVisible();
		}
		await openSection('Event Type');
		for (const type of eventTypes) {
			await expect.soft(panel.getByRole('checkbox', { name: type, exact: true }), `event type ${type}`).not.toBeChecked();
		}
		await openSection('Action');
		for (const action of actions) {
			await expect.soft(panel.getByRole('checkbox', { name: action, exact: true }), `action ${action}`).not.toBeChecked();
		}
		await openSection('Date Range');
		await expect.soft(panel.getByText('From Date & Time', { exact: true })).toBeVisible();
		await expect.soft(panel.getByText('To Date & Time', { exact: true })).toBeVisible();
		await expect.soft(panel.getByRole('textbox', { name: 'Select date' })).toHaveCount(2);
		await openSection('User');
		await expect.soft(panel.getByRole('textbox', { name: 'Search for a user' })).toBeVisible();
		// The signed-in account is among the users to choose from.
		await expect.soft(panel.getByRole('checkbox', { name: process.env.TESTSIGMA_EMAIL, exact: true })).toBeAttached();
		await openSection('Project');
		// Searching the projects finds the one the other specs work in.
		await panel.getByRole('textbox', { name: 'Search for a project' }).fill(projectName);
		await expect.soft(panel.getByRole('checkbox', { name: projectName, exact: true })).toBeAttached();
		await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(run.page.getByRole('heading', { name: 'Filters' })).toHaveCount(0);
		// Cancelling applies nothing.
		await expect(run.main.getByRole('button', { name: 'Clear All', exact: true })).toHaveCount(0);
	});

	test('Filter the log to sign-ins and clear the filter', async () => {
		await openFilters();
		await openSection('Event Type');
		await filters().getByText('Authentication', { exact: true }).click();
		await openSection('Action');
		await filters().getByText('Login', { exact: true }).click();
		await filters().getByRole('button', { name: 'Apply', exact: true }).click();
		// Each filter in use shows how many of its choices are picked, the count in an element of its own.
		await expect(run.main.getByText(/^Event Type\s*\(1\)$/)).toBeVisible();
		await expect(run.main.getByText(/^Action\s*\(1\)$/)).toBeVisible();
		// Signing in for this check logged an entry, so there is always at least one.
		const rows = entryRows(run.main);
		await expect(rows.first()).toBeVisible();
		for (let index = 0; index < await rows.count(); index += 1) {
			const lines = await entryLines(rows.nth(index));
			expect.soft(lines.slice(1, 3), `entry ${index + 1}`).toEqual(['Authentication', 'Login']);
		}
		await run.main.getByRole('button', { name: 'Clear All', exact: true }).click();
		await expect(run.main.getByText(/^Event Type\s*\(1\)$/)).toHaveCount(0);
		await reopenTab(run.page, run.tab);
	});
});
