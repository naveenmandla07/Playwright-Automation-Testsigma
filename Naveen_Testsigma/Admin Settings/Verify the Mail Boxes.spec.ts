/**
 * The Mail Boxes tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Mail Boxes tab and check its elements, including the link to its documentation.
 * - Check every mailbox listed has a name and a Testsigma email address.
 * - Choose a mailbox and check what it shows: its name, address and incoming-messages switch, the note saying
 *   whether incoming messages are on, and its messages.
 * - Open a message and check its contents are shown.
 *
 * Nothing is changed: the incoming-messages switch is checked but never used. The mailboxes and their messages
 * belong to the account, so they are read from the page.
 */
import { expect, test, type Locator } from '@playwright/test';
import { expectTabElements, openTab, useSettingsTab } from '../support/admin-settings';

// Each mailbox is a row inside the grid's own wrapping row.
function mailboxRows(main: Locator) {
	return main.getByRole('grid').getByRole('row').getByRole('row');
}

// A message is listed by its sender and subject, e.g. "Airmeet 937169 - Your Airmeet verification code", with the
// date it arrived, e.g. "Mar 09, 2026".
const messageDate = /^\w{3} \d{2}, \d{4}$/;

test.describe('Verify the Mail Boxes', () => {
	const run = useSettingsTab('Mail Boxes');

	test('Open the Mail Boxes tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
		const guide = run.main.getByRole('link', { name: 'Click here', exact: true });
		await expect(guide).toHaveAttribute('href', 'https://testsigma.com/docs/test-data/types/mailbox/');
		await expect(guide).toHaveAttribute('target', '_blank');
		// The link sits inside its sentence, which carries on after it.
		await expect(run.main.getByText(/Click here\s*for a sample use case$/)).toBeVisible();
	});

	test('Check every mailbox listed', async () => {
		const rows = mailboxRows(run.main);
		await expect(rows.first()).toBeVisible();
		const count = await rows.count();
		test.info().annotations.push({ type: 'mailboxes', description: `${count} mailboxes` });
		for (let index = 0; index < count; index += 1) {
			const cells = rows.nth(index).getByRole('gridcell');
			await expect.soft(cells.nth(0), `name of mailbox ${index + 1}`).toHaveText(/\S/);
			// Testsigma gives each mailbox an address of its own.
			await expect.soft(cells.nth(1), `address of mailbox ${index + 1}`).toHaveText(/^\S+@\S+\.mb\.testsigma\.com$/);
		}
	});

	test('Choose a mailbox and check what it shows', async () => {
		const cells = mailboxRows(run.main).first().getByRole('gridcell');
		const name = (await cells.nth(0).innerText()).trim();
		const address = (await cells.nth(1).innerText()).trim();
		await cells.nth(0).click();
		// The chosen mailbox is shown beside the list, so its name and address appear twice, with its
		// incoming-messages switch.
		await expect(run.main.getByText(name, { exact: true })).toHaveCount(2);
		await expect(run.main.getByText(address, { exact: true })).toHaveCount(2);
		const incoming = run.main.getByTestId('toggle-switch');
		await expect(incoming).toBeVisible();
		const on = await run.main.getByRole('checkbox').first().isChecked();
		test.info().annotations.push({ type: 'incoming messages', description: `${name}: ${on ? 'enabled' : 'disabled'}` });
		// The note says whether incoming messages are on, and that automation receives them either way.
		await expect(run.main.getByText(/^Incoming of messages is\s*(enabled|disabled)/)).toContainText(on ? 'enabled' : 'disabled');
		await expect(run.main.getByText(/You will still receive messages when you're automating\./)).toBeVisible();
		const dates = run.main.getByText(messageDate);
		test.info().annotations.push({ type: 'messages', description: `${await dates.count()} listed` });
	});

	test('Open a message', async () => {
		const dates = run.main.getByText(messageDate);
		test.skip((await dates.count()) === 0, 'The mailbox has no messages.');
		// A message is opened from its line in the list, the one holding its date.
		const line = dates.first().locator('xpath=..');
		const subject = (await line.innerText()).replace(/\s+/g, ' ').replace(/\w{3} \d{2}, \d{4}$/, '').trim();
		// Until a message is opened, nothing on the tab is written in paragraphs; a message's contents are.
		await expect(run.main.getByRole('paragraph')).toHaveCount(0);
		await line.click();
		await expect(run.main.getByRole('paragraph').first()).toBeVisible();
		test.info().annotations.push({ type: 'message', description: subject });
	});
});
