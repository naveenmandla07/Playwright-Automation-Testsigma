/**
 * The Users tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Users tab and check its elements, and that "All" counts every user listed.
 * - Check every user listed: name, status, email and parallel allocation, and the signed-in account's roles.
 * - Show each group of users, active, invited, inactive and waitlisted, and pending requests, and check each lists
 *   as many users as it says.
 * - Search the users, for one that exists and one that does not, and clear the search.
 * - Check the sort options and that "Z to A" and "A to Z" put the users in order.
 * - Open a user's menu and check what it offers, for another user and for the signed-in account.
 * - Open "Add new user" and check the invitation form: the email it needs, the Super Administrator and Read Only
 *   choices, and the projects to assign with their access roles, then cancel it.
 *
 * Nothing is changed: no invitation is sent, and "Make Org Owner", "Edit user role" and "Deactivate User" are
 * checked but never clicked. The users belong to the account, so they are read from the page.
 */
import { expect, test, type Locator } from '@playwright/test';
import { expectMenuOptions, expectTabElements, openTab, reopenTab, searchAttemptTime, searchFor, searchTime, useSettingsTab } from '../../support/admin-settings';
import { accountEmail } from '../../support/testsigma-auth';
import { byName, noResults } from '../../support/common';

type User = { name: string; status: string; email: string; allocation: string; roles: string };

const statuses = ['Active', 'Invited', 'Inactive', 'Waitlisted'];
const groups = [
	{ name: 'Active users', status: 'Active' },
	{ name: 'Invited users', status: 'Invited' },
	{ name: 'Inactive users', status: 'Inactive' },
	{ name: 'Waitlisted users', status: 'Waitlisted' },
];
const sortOptions = ['Name', 'Created Date', 'Updated Date', 'A to Z', 'Z to A'];
const noUsers = 'No Users Available';
const neverInvited = 'playwright.never.invited@example.com';

// Each user is a row inside the grid's own wrapping row.
function userRows(main: Locator) {
	return main.getByRole('grid').getByRole('row').getByRole('row');
}

// A user's lines: name, then any roles, status, email and parallel allocation.
async function listedUsers(main: Locator): Promise<User[]> {
	return Promise.all((await userRows(main).all()).map(async (row) => {
		const lines = (await row.innerText()).split('\n').map((line) => line.trim()).filter(Boolean);
		const emailAt = lines.findIndex((line) => line.includes('@'));
		return {
			name: lines[0],
			roles: lines.slice(1, emailAt - 1).join(', '),
			status: lines[emailAt - 1],
			email: lines[emailAt],
			allocation: lines[emailAt + 1],
		};
	}));
}

test.describe('Verify the Users', () => {
	const run = useSettingsTab('Users');

	function inviteForm() {
		return run.page.getByRole('dialog');
	}

	async function openInviteForm() {
		await run.main.getByRole('button', { name: 'Add new user' }).click();
		await expect(inviteForm().getByRole('textbox', { name: 'Email' })).toBeVisible();
	}

	async function cancelInviteForm() {
		await inviteForm().getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(inviteForm()).toHaveCount(0);
	}

	// The sort options stay open after one is chosen, so open them only when they are not showing.
	async function sortBy(option: string) {
		const choice = run.main.getByText(option, { exact: true }).last();
		if (!(await choice.isVisible())) {
			await run.main.getByText('Sort by', { exact: true }).click();
		}
		await choice.click();
	}

	test('Open the Users tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
		const users = await listedUsers(run.main);
		await expect(run.main.getByText(`All (${users.length})`, { exact: true })).toBeVisible();
	});

	test('Check every user listed', async () => {
		const users = await listedUsers(run.main);
		expect(users.length, 'users listed').toBeGreaterThan(0);
		for (const user of users) {
			expect.soft(user.name, `name of ${user.email}`).toMatch(/\S/);
			expect.soft(statuses, `status of ${user.email}`).toContain(user.status);
			expect.soft(user.email, `email of ${user.name}`).toMatch(/^\S+@\S+\.\S+$/);
			expect.soft(user.allocation, `parallel allocation of ${user.email}`).toMatch(/^(Max available|\d+.*)$/);
			test.info().annotations.push({ type: 'user', description: `${user.name} ${user.roles ? `(${user.roles}) ` : ''}${user.status} ${user.email}` });
		}
		// The signed-in account runs the account, so it is both a Super Admin and the Account Admin.
		const me = users.find((user) => user.email === accountEmail);
		expect(me, 'the signed-in account').toBeDefined();
		expect(me!.roles).toBe('Super Admin, Account Admin');
		expect(me!.status).toBe('Active');
	});

	test('Show each group of users', async () => {
		const users = await listedUsers(run.main);
		for (const group of groups) {
			const tab = run.main.getByText(new RegExp(`^${group.name} \\((\\d+)\\)$`));
			const count = Number((await tab.innerText()).match(/\((\d+)\)/)![1]);
			// Each group counts the users with its status.
			expect.soft(count, group.name).toBe(users.filter((user) => user.status === group.status).length);
			await tab.click();
			if (count === 0) {
				await expect.soft(run.main.getByText(noUsers, { exact: true }), group.name).toBeVisible();
			} else {
				await expect.poll(async () => (await listedUsers(run.main)).map((user) => user.status), { message: group.name, timeout: searchTime })
					.toEqual(Array(count).fill(group.status));
			}
		}
		// Pending requests are users asking to join, who are not among the users listed.
		await run.main.getByText('Pending requests', { exact: true }).click();
		await expect.poll(async () => (await run.main.getByText(noUsers, { exact: true }).isVisible())
			|| (await listedUsers(run.main)).every((user) => !users.some((listed) => listed.email === user.email)), { message: 'pending requests', timeout: searchTime }).toBe(true);
		await run.main.getByText(/^All \(\d+\)$/).click();
		await expect.poll(() => listedUsers(run.main), { timeout: searchTime }).toEqual(users);
	});

	test('Search the users', async () => {
		const search = run.main.getByRole('textbox', { name: 'Search', exact: true });
		const users = await listedUsers(run.main);
		const [first] = users;
		const matching = users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(first.name.toLowerCase()));
		await searchFor(search, first.name, async () => {
			await expect.poll(async () => (await listedUsers(run.main)).map((user) => user.email).sort(), { message: 'users matching the search', timeout: searchAttemptTime })
				.toEqual(matching.map((user) => user.email).sort());
		});
		await search.fill('zz-no-such-user');
		await expect(run.main.getByText(noResults, { exact: true })).toBeVisible({ timeout: searchTime });
		await expect(run.main.getByRole('img', { name: 'Empty state illustration' })).toBeVisible();
		await search.clear();
		await expect.poll(() => listedUsers(run.main), { timeout: searchTime }).toEqual(users);
	});

	test('Sort the users', async () => {
		await expectMenuOptions(run.main, () => run.main.getByText('Sort by', { exact: true }).click(), sortOptions);
		const names = (await listedUsers(run.main)).map((user) => user.name);
		await sortBy('Z to A');
		await expect.poll(async () => (await listedUsers(run.main)).map((user) => user.name), { timeout: searchTime })
			.toEqual([...names].sort(byName).reverse());
		// A to Z is how the users are listed at first, so the list is left that way.
		await sortBy('A to Z');
		await expect.poll(async () => (await listedUsers(run.main)).map((user) => user.name), { timeout: searchTime })
			.toEqual([...names].sort(byName));
		await reopenTab(run.page, run.tab);
	});

	test('Check what a user\'s menu offers', async () => {
		const users = await listedUsers(run.main);
		const other = users.find((user) => user.email !== accountEmail && user.status === 'Active');
		test.skip(!other, 'There is no other active user.');
		const row = userRows(run.main).filter({ hasText: other!.email });
		await row.getByTestId('more-vertical').click();
		for (const choice of ['View details', 'Make Org Owner', 'Edit user role', 'Deactivate User']) {
			await expect.soft(row.getByText(choice, { exact: true }), choice).toBeVisible();
		}
		await run.main.getByText('Sort by', { exact: true }).click();
		await reopenTab(run.page, run.tab);

		// The signed-in account can only view its own details.
		const mine = userRows(run.main).filter({ hasText: accountEmail });
		await mine.getByTestId('more-vertical').click();
		await expect(mine.getByText('View details', { exact: true })).toBeVisible();
		for (const choice of ['Make Org Owner', 'Edit user role', 'Deactivate User']) {
			await expect.soft(mine.getByText(choice, { exact: true }), choice).toHaveCount(0);
		}
		await reopenTab(run.page, run.tab);
	});

	test('Open the Add new user form and check its fields', async () => {
		await openInviteForm();
		const form = inviteForm();
		await expect(form.getByText('Add new user', { exact: true })).toBeVisible();
		await expect(form.getByRole('textbox', { name: 'Email' })).toBeEmpty();
		await expect(form.getByRole('textbox', { name: 'Email' })).toHaveAttribute('placeholder', 'Enter email');
		await expect(form.getByRole('checkbox', { name: 'Super Administrator' })).not.toBeChecked();
		await expect(form.getByRole('checkbox', { name: 'Read Only' })).not.toBeChecked();
		await expect(form.getByText(/Select projects to assign/)).toBeVisible();
		await expect(form.getByRole('textbox', { name: 'Search Project to assign' })).toBeVisible();
		// Every project is listed to assign; a ticked project shows the access role the new user would have in it.
		const projects = form.getByRole('grid').getByRole('row').getByRole('row');
		await expect(projects.first()).toBeVisible();
		const count = await projects.count();
		let ticked = 0;
		for (let index = 0; index < count; index += 1) {
			const project = projects.nth(index);
			const name = await project.getByRole('checkbox').getAttribute('aria-label');
			if (await project.getByRole('checkbox').isChecked()) {
				ticked += 1;
				await expect.soft(project.getByRole('button'), `access role in ${name}`).toHaveText(/\S/);
			} else {
				await expect.soft(project.getByRole('button'), `access role in ${name}`).toHaveCount(0);
			}
		}
		test.info().annotations.push({ type: 'projects to assign', description: `${count} shown, ${ticked} ticked` });
		await expect(form.getByText(/The user will be able to access the product, once the user accepts the invite/)).toBeVisible();
		// "Send Invite" can be clicked before an email is entered.
		await expect(form.getByRole('button', { name: 'Send Invite' })).toBeEnabled();
		await cancelInviteForm();
	});

	test('An invalid email is pointed out', async () => {
		await openInviteForm();
		const email = inviteForm().getByRole('textbox', { name: 'Email' });
		await email.fill('not-an-email');
		await inviteForm().getByRole('textbox', { name: 'Search Project to assign' }).click();
		await expect(inviteForm().getByText('email must be a valid email', { exact: true })).toBeVisible();
		await email.fill(neverInvited);
		await expect(inviteForm().getByText('email must be a valid email', { exact: true })).toHaveCount(0);
		await cancelInviteForm();
	});

	test('A Super Administrator gets every project, and may be an Account Administrator', async () => {
		await openInviteForm();
		const form = inviteForm();
		await form.getByText('Super Administrator', { exact: true }).click();
		await expect(form.getByRole('checkbox', { name: 'Super Administrator' })).toBeChecked();
		await expect(form.getByRole('checkbox', { name: 'Account Administrator' })).not.toBeChecked();
		await expect(form.getByText(/By default full access will be granted to all existing projects and the projects that your team creates in the future/)).toBeVisible();
		// Projects are no longer picked one by one.
		await expect(form.getByRole('textbox', { name: 'Search Project to assign' })).toHaveCount(0);
		await expect(form.getByRole('checkbox', { name: 'Read Only' })).toHaveCount(0);
		await form.getByText('Super Administrator', { exact: true }).click();
		await expect(form.getByRole('textbox', { name: 'Search Project to assign' })).toBeVisible();
		await cancelInviteForm();
	});

	test('A Read Only user reads specific pages', async () => {
		await openInviteForm();
		const form = inviteForm();
		await form.getByText('Read Only', { exact: true }).click();
		await expect(form.getByRole('checkbox', { name: 'Read Only' })).toBeChecked();
		await expect(form.getByText(/The user will have read-only access to the product on specific pages/)).toBeVisible();
		await expect(form.getByRole('textbox', { name: 'Search Project to assign' })).toHaveCount(0);
		await expect(form.getByRole('checkbox', { name: 'Super Administrator' })).toHaveCount(0);
		await form.getByText('Read Only', { exact: true }).click();
		await expect(form.getByRole('textbox', { name: 'Search Project to assign' })).toBeVisible();
		await cancelInviteForm();
	});

	test('Search the projects to assign', async () => {
		await openInviteForm();
		const form = inviteForm();
		const projects = form.getByRole('grid').getByRole('row').getByRole('row');
		const first = (await projects.first().getByRole('checkbox').getAttribute('aria-label'))!;
		const shownProjects = () => projects.getByRole('checkbox').evaluateAll((boxes) => boxes.map((box) => (box.getAttribute('aria-label') ?? '').toLowerCase()));
		await form.getByRole('textbox', { name: 'Search Project to assign' }).fill(first);
		// Only projects matching the search stay listed, including the one searched for.
		await expect.poll(async () => (await shownProjects()).every((name) => name.includes(first.toLowerCase())), { message: 'projects matching the search', timeout: searchTime }).toBe(true);
		expect(await shownProjects()).toContain(first.toLowerCase());
		await cancelInviteForm();
	});
});
