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
import { expect, test } from '@playwright/test';
import { searchAttemptTime, searchTime } from '../../pages/settings/SettingsPage';
import { UsersTab } from '../../pages/settings/tabs/UsersTab';
import { useSettingsTab } from '../../support/admin-settings';
import { accountEmail } from '../../support/testsigma-auth';
import { byName, noResults } from '../../support/common';

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

test.describe('Verify the Users', () => {
	const run = useSettingsTab(UsersTab);

	test('Open the Users tab and check its elements', async () => {
		await run.tab.open();
		await run.tab.expectElements();
		const users = await run.tab.listedUsers();
		await expect(run.tab.text(`All (${users.length})`)).toBeVisible();
	});

	test('Check every user listed', async () => {
		const users = await run.tab.listedUsers();
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
		const users = await run.tab.listedUsers();
		for (const group of groups) {
			const tab = run.tab.group(group.name);
			const count = Number((await tab.innerText()).match(/\((\d+)\)/)![1]);
			// Each group counts the users with its status.
			expect.soft(count, group.name).toBe(users.filter((user) => user.status === group.status).length);
			await tab.click();
			if (count === 0) {
				await expect.soft(run.tab.text(noUsers), group.name).toBeVisible();
			} else {
				await expect.poll(async () => (await run.tab.listedUsers()).map((user) => user.status), { message: group.name, timeout: searchTime })
					.toEqual(Array(count).fill(group.status));
			}
		}
		// Pending requests are users asking to join, who are not among the users listed.
		await run.tab.pendingRequests.click();
		await expect.poll(async () => (await run.tab.text(noUsers).isVisible())
			|| (await run.tab.listedUsers()).every((user) => !users.some((listed) => listed.email === user.email)), { message: 'pending requests', timeout: searchTime }).toBe(true);
		await run.tab.allGroup.click();
		await expect.poll(() => run.tab.listedUsers(), { timeout: searchTime }).toEqual(users);
	});

	test('Search the users', async () => {
		const search = run.tab.search;
		const users = await run.tab.listedUsers();
		const [first] = users;
		const matching = users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(first.name.toLowerCase()));
		await run.tab.searchFor(search, first.name, async () => {
			await expect.poll(async () => (await run.tab.listedUsers()).map((user) => user.email).sort(), { message: 'users matching the search', timeout: searchAttemptTime })
				.toEqual(matching.map((user) => user.email).sort());
		});
		await search.fill('zz-no-such-user');
		await expect(run.tab.text(noResults)).toBeVisible({ timeout: searchTime });
		await expect(run.tab.emptyState).toBeVisible();
		await search.clear();
		await expect.poll(() => run.tab.listedUsers(), { timeout: searchTime }).toEqual(users);
	});

	test('Sort the users', async () => {
		await run.tab.expectMenuOptions(() => run.tab.sortByLabel.click(), sortOptions);
		const names = (await run.tab.listedUsers()).map((user) => user.name);
		await run.tab.sortBy('Z to A');
		await expect.poll(async () => (await run.tab.listedUsers()).map((user) => user.name), { timeout: searchTime })
			.toEqual([...names].sort(byName).reverse());
		// A to Z is how the users are listed at first, so the list is left that way.
		await run.tab.sortBy('A to Z');
		await expect.poll(async () => (await run.tab.listedUsers()).map((user) => user.name), { timeout: searchTime })
			.toEqual([...names].sort(byName));
		await run.tab.reopen();
	});

	test('Check what a user\'s menu offers', async () => {
		const users = await run.tab.listedUsers();
		const other = users.find((user) => user.email !== accountEmail && user.status === 'Active');
		test.skip(!other, 'There is no other active user.');
		const row = run.tab.userRow(other!.email);
		await run.tab.openUserMenu(row);
		for (const choice of ['View details', 'Make Org Owner', 'Edit user role', 'Deactivate User']) {
			await expect.soft(row.getByText(choice, { exact: true }), choice).toBeVisible();
		}
		await run.tab.sortByLabel.click();
		await run.tab.reopen();

		// The signed-in account can only view its own details.
		const mine = run.tab.userRow(accountEmail);
		await run.tab.openUserMenu(mine);
		await expect(mine.getByText('View details', { exact: true })).toBeVisible();
		for (const choice of ['Make Org Owner', 'Edit user role', 'Deactivate User']) {
			await expect.soft(mine.getByText(choice, { exact: true }), choice).toHaveCount(0);
		}
		await run.tab.reopen();
	});

	test('Open the Add new user form and check its fields', async () => {
		const form = await run.tab.openInviteForm();
		await expect(form.text('Add new user')).toBeVisible();
		await expect(form.email).toBeEmpty();
		await expect(form.email).toHaveAttribute('placeholder', 'Enter email');
		await expect(form.checkbox('Super Administrator')).not.toBeChecked();
		await expect(form.checkbox('Read Only')).not.toBeChecked();
		await expect(form.text(/Select projects to assign/)).toBeVisible();
		await expect(form.projectSearch).toBeVisible();
		// Every project is listed to assign; a ticked project shows the access role the new user would have in it.
		const projects = form.projects;
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
		await expect(form.text(/The user will be able to access the product, once the user accepts the invite/)).toBeVisible();
		// "Send Invite" can be clicked before an email is entered.
		await expect(form.sendInvite).toBeEnabled();
		await form.cancel();
	});

	test('An invalid email is pointed out', async () => {
		const form = await run.tab.openInviteForm();
		const email = form.email;
		await email.fill('not-an-email');
		await form.projectSearch.click();
		await expect(form.text('email must be a valid email')).toBeVisible();
		await email.fill(neverInvited);
		await expect(form.text('email must be a valid email')).toHaveCount(0);
		await form.cancel();
	});

	test('A Super Administrator gets every project, and may be an Account Administrator', async () => {
		const form = await run.tab.openInviteForm();
		await form.text('Super Administrator').click();
		await expect(form.checkbox('Super Administrator')).toBeChecked();
		await expect(form.checkbox('Account Administrator')).not.toBeChecked();
		await expect(form.text(/By default full access will be granted to all existing projects and the projects that your team creates in the future/)).toBeVisible();
		// Projects are no longer picked one by one.
		await expect(form.projectSearch).toHaveCount(0);
		await expect(form.checkbox('Read Only')).toHaveCount(0);
		await form.text('Super Administrator').click();
		await expect(form.projectSearch).toBeVisible();
		await form.cancel();
	});

	test('A Read Only user reads specific pages', async () => {
		const form = await run.tab.openInviteForm();
		await form.text('Read Only').click();
		await expect(form.checkbox('Read Only')).toBeChecked();
		await expect(form.text(/The user will have read-only access to the product on specific pages/)).toBeVisible();
		await expect(form.projectSearch).toHaveCount(0);
		await expect(form.checkbox('Super Administrator')).toHaveCount(0);
		await form.text('Read Only').click();
		await expect(form.projectSearch).toBeVisible();
		await form.cancel();
	});

	test('Search the projects to assign', async () => {
		const form = await run.tab.openInviteForm();
		const projects = form.projects;
		const first = (await projects.first().getByRole('checkbox').getAttribute('aria-label'))!;
		const shownProjects = () => projects.getByRole('checkbox').evaluateAll((boxes) => boxes.map((box) => (box.getAttribute('aria-label') ?? '').toLowerCase()));
		await form.projectSearch.fill(first);
		// Only projects matching the search stay listed, including the one searched for.
		await expect.poll(async () => (await shownProjects()).every((name) => name.includes(first.toLowerCase())), { message: 'projects matching the search', timeout: searchTime }).toBe(true);
		expect(await shownProjects()).toContain(first.toLowerCase());
		await form.cancel();
	});
});
