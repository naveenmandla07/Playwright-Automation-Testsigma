/**
 * The Imports tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Imports tab and check its elements.
 * - Check every import listed: where it went to and came from, who started it and when, how many artefacts it
 *   brought and its status.
 * - Open an import's summary, check what it shows, and close it.
 * - Switch to Postman imports and check its columns and every import listed there.
 * - Open "Import" and check the Postman collection form, including the files it accepts, then close it.
 *
 * Nothing is imported: no file is chosen and the form is closed. The imports belong to the account, so they are
 * read from the page and checked for what every import shows.
 */
import { expect, test, type Locator } from '@playwright/test';
import { expectTabElements, openTab, reopenTab, useSettingsTab } from '../../support/admin-settings';

const artefacts = ['Variables', 'Step Groups', 'Test Cases', 'Environments', 'Elements', 'Test Suites', 'Test Plans', 'Test Data Profile', 'Uploads'];
const postmanColumns = ['Project', 'Application', 'Version', 'Initiated by', 'Action', 'Status'];
// Who started something, and when, e.g. "Production Test Aug 14, 2026, 08:03 AM".
const byAndWhen = /\S.*\w{3} \d{1,2}, \d{4}, \d{1,2}:\d{2} (AM|PM)$/;

// Each import is a row inside the grid's own wrapping row.
function importRows(main: Locator) {
	return main.getByRole('grid').getByRole('row').getByRole('row');
}

test.describe('Verify the Imports', () => {
	const run = useSettingsTab('Imports');

	test('Open the Imports tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
	});

	test('Check every import listed', async () => {
		const rows = importRows(run.main);
		await expect(rows.first()).toBeVisible();
		const count = await rows.count();
		test.info().annotations.push({ type: 'imports', description: `${count} imports` });
		for (let index = 0; index < count; index += 1) {
			const cells = rows.nth(index).getByRole('gridcell');
			const to = (await cells.nth(0).innerText()).replace(/\s+/g, ' ').trim();
			// Where it was imported to and from: a project, application and version each.
			expect.soft(to, `imported to of import ${index + 1}`).not.toBe('');
			await expect.soft(cells.nth(1), `imported from of ${to}`).toHaveText(/\S/);
			await expect.soft(cells.nth(2), `initiated by of ${to}`).toHaveText(byAndWhen);
			await expect.soft(cells.nth(3), `imported artefact count of ${to}`).toHaveText(/^\d+$/);
			await expect.soft(cells.nth(4), `status of ${to}`).toHaveText(/\S/);
		}
	});

	test('Open an import\'s summary', async () => {
		const cells = importRows(run.main).first().getByRole('gridcell');
		await cells.first().click();
		const summary = run.page.getByRole('dialog');
		await expect(summary.getByRole('heading', { name: 'Import Summary' })).toBeVisible();
		for (const text of ['Imported At', 'Initiated by', 'From', 'To', 'Imported artefact']) {
			await expect.soft(summary.getByText(text, { exact: true }).first(), text).toBeVisible();
		}
		// Every kind of artefact is counted, even when none were imported.
		for (const artefact of artefacts) {
			await expect.soft(summary.getByRole('paragraph').filter({ hasText: new RegExp(`^${artefact}\\s*\\d+$`) }), artefact).toBeVisible();
		}
		await expect(summary.getByText(/^Save Point - before this import/)).toBeVisible();
		await summary.getByRole('button', { name: 'OK, Got It' }).click();
		await expect(summary).toHaveCount(0);
	});

	test('Switch to Postman imports', async () => {
		await run.main.getByText('Postman imports', { exact: true }).click();
		for (const column of postmanColumns) {
			await expect.soft(run.main.getByText(column, { exact: true }).last(), `column ${column}`).toBeVisible();
		}
		const rows = importRows(run.main);
		const count = await rows.count();
		test.info().annotations.push({ type: 'Postman imports', description: `${count} imports` });
		if (count === 0) {
			return;
		}
		for (let index = 0; index < count; index += 1) {
			const cells = rows.nth(index).getByRole('gridcell');
			await expect.soft(cells.nth(0), `project of Postman import ${index + 1}`).toHaveText(/\S/);
			await expect.soft(cells.nth(3), `initiated by of Postman import ${index + 1}`).toHaveText(byAndWhen);
			// What was imported, e.g. "import Testsigma2.postman_collection.json".
			await expect.soft(cells.nth(4), `action of Postman import ${index + 1}`).toHaveText(/\.json$|\.zip$/);
			await expect.soft(cells.nth(5), `status of Postman import ${index + 1}`).toHaveText(/\S/);
		}
		await reopenTab(run.page, run.tab);
	});

	test('Open the Import form and close it', async () => {
		await run.main.getByRole('button', { name: 'Import', exact: true }).click();
		const form = run.page.getByRole('dialog');
		await expect(form.getByText('Import Postman Collection', { exact: true })).toBeVisible();
		for (const text of ['Select File for Import', 'Import Location']) {
			await expect.soft(form.getByText(text, { exact: true }), text).toBeVisible();
		}
		await expect(form.getByRole('link', { name: 'Learn more about exporting collection in Postman' }))
			.toHaveAttribute('href', 'https://testsigma.com/docs/test-cases/manage/import-postman-to-testsigma/#export-postman-collections');
		await expect(form.getByRole('link', { name: 'Learn more about Postman collection import in Testsigma' }))
			.toHaveAttribute('href', 'https://testsigma.com/docs/test-cases/manage/import-postman-to-testsigma/#import-postman-collections');
		await expect(form.getByRole('note').filter({ hasText: 'We recommend importing the Postman collection under API Project / Application.' })).toBeVisible();
		await expect(form.getByText(/If collection name already exists, we will be creating a new entry for the import/)).toBeVisible();
		await expect(form.getByText(/Test Scripts, Pre requisite scripts, Settings, Unsupported Authorisation & Http methods, graphQL request are not mapped/)).toBeVisible();
		// No collection is chosen yet, so there is nothing to preview.
		await expect(form.getByRole('note').filter({ hasText: 'Upload a Postman collection to preview the folder structure in Testsigma' })).toBeVisible();
		await expect(form.getByRole('img', { name: 'No File Selected' })).toBeVisible();
		// A collection is a JSON file, or a zip of one.
		await expect(form.locator('input[type=file]')).toHaveAttribute('accept', 'application/json, application/zip');
		// The form ignores Escape; its close icon closes it.
		await form.getByTestId('close').click();
		await expect(form).toHaveCount(0);
	});
});
