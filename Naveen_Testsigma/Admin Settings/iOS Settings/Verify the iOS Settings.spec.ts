/**
 * The iOS Settings tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the iOS Settings tab and check its elements.
 * - Check every provisioning profile listed: its name, Apple Team ID, downloads of its signing request and
 *   profile, who created it and when, and when it expires.
 * - Search the profiles, for one that exists and one that does not, and clear the search.
 * - Open "Create new profile" and check its four steps, and that a signing request can be generated once the
 *   profile has a name, then cancel it.
 * - Switch to Web Driver Agent and check its list, then open "Upload new" and check its form, then cancel it.
 *
 * Nothing is created or uploaded: "Generate Request", "Create", "Save" and the upload buttons are checked but never
 * clicked, and the delete icon is never used. The profiles belong to the account, so they are read from the page.
 */
import { expect, test, type Locator } from '@playwright/test';
import { expectTabElements, openTab, reopenTab, searchAttemptTime, searchFor, searchTime, useSettingsTab } from '../../support/admin-settings';
import { escapeRegExp, noResults } from '../../support/common';

// Each profile is a row inside the grid's own wrapping row.
function profileRows(main: Locator) {
	return main.getByRole('grid').getByRole('row').getByRole('row');
}

async function profileNames(main: Locator) {
	return Promise.all((await profileRows(main).all()).map(async (row) => (await row.getByRole('gridcell').first().innerText()).trim()));
}

test.describe('Verify the iOS Settings', () => {
	const run = useSettingsTab('iOS Settings');

	test('Open the iOS Settings tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
	});

	test('Check every provisioning profile listed', async () => {
		const rows = profileRows(run.main);
		const count = await rows.count();
		test.info().annotations.push({ type: 'provisioning profiles', description: `${count} profiles` });
		test.skip(count === 0, 'The account has no provisioning profiles.');
		for (let index = 0; index < count; index += 1) {
			const row = rows.nth(index);
			const cells = row.getByRole('gridcell');
			const name = (await cells.nth(0).innerText()).trim();
			expect.soft(name, `name of profile ${index + 1}`).toMatch(/\S/);
			// Apple Team IDs are ten letters and digits.
			await expect.soft(cells.nth(1), `Apple Team ID of ${name}`).toHaveText(/^[A-Z0-9]{10}$/);
			// The signing request and the provisioning profile can each be downloaded.
			for (const [column, what] of [[2, 'signing request'], [3, 'provisioning profile']] as const) {
				const download = cells.nth(column).getByRole('link', { name: 'Download' });
				await expect.soft(download, `${what} of ${name}`).toBeVisible();
				await expect.soft(download, `${what} of ${name}`).toHaveAttribute('href', /^https:\/\//);
			}
			// Who created it and when, e.g. "Production Test May 11, 2026 11:47:16 AM".
			await expect.soft(cells.nth(4), `created by of ${name}`).toHaveText(/\S.*\w{3} \d{1,2}, \d{4} \d{1,2}:\d{2}:\d{2} (AM|PM)$/);
			await expect.soft(cells.nth(5), `expiry of ${name}`).toHaveText(/^\w{3} \d{1,2}, \d{4}$/);
			await row.hover();
			await expect.soft(row.getByTestId('delete'), `delete icon of ${name}`).toBeAttached();
		}
	});

	test('Search the provisioning profiles', async () => {
		const search = run.main.getByRole('textbox', { name: 'Search', exact: true });
		const all = await profileNames(run.main);
		test.skip(all.length === 0, 'The account has no provisioning profiles.');
		const [first] = all;
		await searchFor(search, first, async () => {
			await expect.poll(() => profileNames(run.main), { timeout: searchAttemptTime }).toEqual(all.filter((name) => name.toLowerCase().includes(first.toLowerCase())));
		});
		await search.fill('zz-no-such-profile');
		await expect(run.main.getByText(noResults, { exact: true })).toBeVisible({ timeout: searchTime });
		await expect(run.main.getByRole('img', { name: 'Empty state illustration' })).toBeVisible();
		await search.clear();
		await expect.poll(() => profileNames(run.main), { timeout: searchTime }).toEqual(all);
	});

	test('Open Create new profile and check its steps', async () => {
		await run.main.getByText('Create new profile', { exact: true }).click();
		await expect(run.main.getByText('Create New Profile', { exact: true })).toBeVisible();
		const steps = [
			{ number: '1', title: 'Profile Name' },
			{ number: '2', title: 'Certificate Signing Request (CSR)', about: 'Generate new Certificate Signing Request (CSR), Use this at Apple Developer account to generate new certificate', button: 'Generate Request' },
			{ number: '3', title: 'Upload Certificate', about: 'Upload Certificate Generated using above Certificate Signing Request (CSR), Use this at Apple Developer.', button: 'Upload Signed file' },
			{ number: '4', title: 'Upload Provisioning Profile', about: 'Upload mobile provisioning profile created using above certificate and linked list of devices you would like to automate', button: 'Upload Provisioning Profile' },
		];
		for (const step of steps) {
			await expect.soft(run.main.getByRole('heading', { name: step.number, exact: true }), `step ${step.number}`).toBeVisible();
			await expect.soft(run.main.getByRole('paragraph').filter({ hasText: new RegExp(`^${escapeRegExp(step.title)}$`) }), step.title).toBeVisible();
			if (step.about) {
				await expect.soft(run.main.getByRole('paragraph').filter({ hasText: step.about }), step.title).toBeVisible();
			}
			// Each later step waits for the one before it.
			if (step.button) {
				await expect.soft(run.main.getByRole('button', { name: step.button, exact: true }), step.button).toBeDisabled();
			}
		}
		await expect(run.main.getByRole('textbox', { name: 'Enter name' })).toBeEmpty();
		await expect(run.main.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
		// Once the profile has a name, its signing request can be generated.
		await run.main.getByRole('textbox', { name: 'Enter name' }).fill('Playwright profile that is never created');
		await expect(run.main.getByRole('button', { name: 'Generate Request', exact: true })).toBeEnabled();
		await expect(run.main.getByRole('button', { name: 'Upload Signed file', exact: true })).toBeDisabled();
		await expect(run.main.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
		await run.main.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(run.main.getByText('Create New Profile', { exact: true })).toHaveCount(0);
		await expect(run.main.getByText('Create new profile', { exact: true })).toBeVisible();
	});

	test('Switch to Web Driver Agent', async () => {
		await run.main.getByText('Web Driver Agent', { exact: true }).click();
		for (const column of ['Name', 'WDA', 'Created By', 'No.of time used']) {
			await expect.soft(run.main.getByText(column, { exact: true }).last(), `column ${column}`).toBeVisible();
		}
		const none = run.main.getByText('Upload your first Web Driver Agent by clicking the button below.', { exact: true });
		if (await none.isVisible()) {
			test.info().annotations.push({ type: 'Web Driver Agents', description: 'none' });
			await expect(run.main.getByRole('img', { name: 'Empty state illustration' })).toBeVisible();
		}
		await expect(run.main.getByRole('button', { name: 'Upload new' }).first()).toBeVisible();
	});

	test('Open Upload new WDA and check its form', async () => {
		await reopenTab(run.page, run.tab);
		await run.main.getByText('Web Driver Agent', { exact: true }).click();
		await run.main.getByRole('button', { name: 'Upload new' }).first().click();
		await expect(run.main.getByText('Upload new WDA', { exact: true })).toBeVisible();
		await expect(run.main.getByRole('paragraph').filter({ hasText: /^Profile Name\*?$/ })).toBeVisible();
		await expect(run.main.getByRole('textbox', { name: 'Enter name' })).toBeEmpty();
		await expect(run.main.getByRole('paragraph').filter({ hasText: 'Upload Web Driver Agent (WDA)' })).toBeVisible();
		await expect(run.main.getByRole('paragraph').filter({ hasText: /^Upload your signed WDA file here\./ })).toBeVisible();
		// A signed sample can be downloaded for those without one.
		await expect(run.main.getByRole('link', { name: 'Sample WDA' })).toHaveAttribute('href', 'https://static.testsigma.com/wda/wda.ipa');
		// A WDA is an iOS app, uploaded as an .ipa file.
		await expect(run.main.locator('input[type=file]')).toHaveAttribute('accept', '.ipa');
		await expect(run.main.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
		await run.main.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(run.main.getByText('Upload new WDA', { exact: true })).toHaveCount(0);
		await reopenTab(run.page, run.tab);
	});
});
