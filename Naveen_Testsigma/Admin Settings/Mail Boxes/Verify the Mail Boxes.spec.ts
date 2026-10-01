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
import { expect, test } from '@playwright/test';
import { MailBoxesTab } from '../../pages/settings/tabs/MailBoxesTab';
import { useSettingsTab } from '../../support/admin-settings';

test.describe('Verify the Mail Boxes', () => {
	const run = useSettingsTab(MailBoxesTab);

	test('Open the Mail Boxes tab and check its elements', async () => {
		await run.tab.open();
		await run.tab.expectElements();
		const guide = run.tab.guide;
		await expect(guide).toHaveAttribute('href', 'https://testsigma.com/docs/test-data/types/mailbox/');
		await expect(guide).toHaveAttribute('target', '_blank');
		// The link sits inside its sentence, which carries on after it.
		await expect(run.tab.text(/Click here\s*for a sample use case$/)).toBeVisible();
	});

	test('Check every mailbox listed', async () => {
		const rows = run.tab.rows;
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
		const cells = run.tab.rows.first().getByRole('gridcell');
		const name = (await cells.nth(0).innerText()).trim();
		const address = (await cells.nth(1).innerText()).trim();
		await cells.nth(0).click();
		// The chosen mailbox is shown beside the list, so its name and address appear twice, with its
		// incoming-messages switch.
		await expect(run.tab.text(name)).toHaveCount(2);
		await expect(run.tab.text(address)).toHaveCount(2);
		const incoming = run.tab.incomingSwitch;
		await expect(incoming).toBeVisible();
		const on = await run.tab.incomingCheckbox.isChecked();
		test.info().annotations.push({ type: 'incoming messages', description: `${name}: ${on ? 'enabled' : 'disabled'}` });
		// The note says whether incoming messages are on, and that automation receives them either way.
		await expect(run.tab.text(/^Incoming of messages is\s*(enabled|disabled)/)).toContainText(on ? 'enabled' : 'disabled');
		await expect(run.tab.text(/You will still receive messages when you're automating\./)).toBeVisible();
		const dates = run.tab.messageDates;
		test.info().annotations.push({ type: 'messages', description: `${await dates.count()} listed` });
	});

	test('Open a message', async () => {
		const dates = run.tab.messageDates;
		test.skip((await dates.count()) === 0, 'The mailbox has no messages.');
		const line = run.tab.firstMessage;
		const subject = (await line.innerText()).replace(/\s+/g, ' ').replace(/\w{3} \d{2}, \d{4}$/, '').trim();
		await expect(run.tab.paragraphs).toHaveCount(0);
		await line.click();
		await expect(run.tab.paragraphs.first()).toBeVisible();
		test.info().annotations.push({ type: 'message', description: subject });
	});
});
