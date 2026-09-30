/**
 * The User Roles tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the User Roles tab and check its elements.
 * - Check what each role is for, shown on hovering the help icon beside it.
 * - Check each role's access to every entity: Full, Read only or No access.
 *
 * The tab only shows what each role may do; there is nothing on it to change.
 */
import { expect, test } from '@playwright/test';
import { expectTabElements, openTab, useSettingsTab } from '../support/admin-settings';

const roles = [
	{ name: 'Super Administrator', about: 'Has complete control over the Testsigma account, but is restricted from viewing Account or Billing related information.' },
	{ name: 'Test Manager', about: 'Can manage multiple projects, including adding applications and versions in each project.' },
	{ name: 'Test Lead', about: 'Can manage everything in the assigned project, including adding applications, versions in that project.' },
	{
		name: 'Automation Engineer/Developer',
		about: 'Can write, view, update test cases, and everything required to write test cases like test data profiles, ui identifier, custom functions etc.',
	},
	{ name: 'Read only', about: 'Can only read all modules.' },
];

type Access = 'Full' | 'Read only' | 'No access';
const F: Access = 'Full';
const R: Access = 'Read only';
const N: Access = 'No access';

// Each entity with the access of each role, in the order of the roles above.
const access: [string, Access[]][] = [
	['Projects', [F, F, R, R, R]],
	['Applications', [F, F, F, R, R]],
	['Versions', [F, F, F, R, R]],
	['Requirements', [F, F, F, F, R]],
	['Test Cases', [F, F, F, F, R]],
	['Test Steps', [F, F, F, F, R]],
	['Requirement Types', [F, F, R, R, R]],
	['Test Case Types', [F, F, R, R, R]],
	['Test Data Profiles', [F, F, F, F, R]],
	['Test Case Priorities', [F, F, R, R, R]],
	['Elements', [F, F, F, F, R]],
	['Application Types', [F, F, F, R, R]],
	['Executions', [F, F, F, F, R]],
	['Test Machines', [F, F, F, F, R]],
	['Test Suites', [F, F, F, F, R]],
	['Schedules', [F, F, F, F, R]],
	['Local Devices', [F, F, F, F, N]],
	['User Management', [F, R, R, R, N]],
	['Uploads', [F, F, F, F, R]],
	['NLPs', [F, F, F, F, R]],
	['Roles', [F, R, N, N, N]],
	['Results', [F, F, F, F, R]],
	['Testcase Group Report', [F, F, F, F, R]],
	['Custom Functions', [F, F, F, F, N]],
	['Environments', [F, F, F, F, R]],
	['Custom Fields', [F, F, R, R, N]],
	['Plugins', [F, F, F, R, N]],
];

test.describe('Verify the User Roles', () => {
	const run = useSettingsTab('User Roles');

	test('Open the User Roles tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
		await expect(run.main.getByText(/Account admin is the only person who has Full access to all entities, billing and account related information/)).toBeVisible();
	});

	test('Check what each role is for', async () => {
		// Each role's heading has a help icon, in the same order as the roles.
		const helps = run.main.getByTestId('help');
		await expect(helps).toHaveCount(roles.length);
		for (const [index, role] of roles.entries()) {
			await helps.nth(index).hover();
			await expect.soft(run.page.getByRole('tooltip', { name: role.about }).first(), role.name).toBeVisible();
		}
	});

	for (const [entity, levels] of access) {
		test(`Access to ${entity}`, async () => {
			const row = run.main.getByRole('row', { name: new RegExp(`^${entity}( (Full|Read only|No access)){5}$`) });
			await expect(row).toBeVisible();
			const shown = (await row.getAttribute('aria-label')) ?? (await row.innerText());
			const given = shown.replace(/\s+/g, ' ').slice(entity.length).trim().match(/Full|Read only|No access/g);
			expect(given, entity).toEqual(levels);
		});
	}
});
