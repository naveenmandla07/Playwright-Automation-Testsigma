/**
 * The Labels tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Labels tab and check its elements, and that "All" counts every label listed.
 * - Search the labels, for one that exists and one that does not, and clear the search.
 * - Check the sort options, and that "A to Z" and "Z to A" put the labels in order.
 * - Check the saved filters: "Linked" lists the labels in use and "Not Linked" those that are not.
 * - Start a new label with "Add New Label" and abandon it, and start editing a label and abandon that.
 * - Select one label and then all of them, check the Delete and selection controls, and clear the selection.
 * - Open a label's linked entities, go through each kind of entity, and close it.
 *
 * Nothing is saved: a new or edited label is left with Escape, which keeps nothing, "Delete" and the delete icon
 * are checked but never clicked, and the list is checked to be unchanged afterwards. The labels belong to the
 * account, so they are read from the page rather than expected by name.
 */
import { expect, test, type Locator } from '@playwright/test';
import { expectMenuOptions, expectTabElements, openTab, reopenTab, searchAttemptTime, searchFor, searchTime, useSettingsTab } from '../../support/admin-settings';
import { byName, noResults } from '../../support/common';

type Label = { name: string; linked: number };

const sortOptions = ['Label Name', 'Created Date', 'Updated Date', 'A to Z', 'Z to A'];
const entityKinds = ['Test Cases', 'Step Groups', 'Test Suites', 'Test Plans', 'Elements'];

// Each label is a row inside the grid's own wrapping row.
function labelRows(main: Locator) {
	return main.getByRole('grid').getByRole('row').getByRole('row');
}

// The labels listed, in order, with how many entities each is linked to.
async function listedLabels(main: Locator): Promise<Label[]> {
	const rows = await labelRows(main).all();
	return Promise.all(rows.map(async (row) => ({
		name: (await row.getByRole('gridcell').first().innerText()).trim(),
		linked: Number((await row.getByRole('gridcell').nth(1).innerText()).trim()),
	})));
}

test.describe('Verify the Labels', () => {
	const run = useSettingsTab('Labels');
	// The labels as first listed, which every check leaves as they were.
	let labels: Label[] = [];

	// Reads the labels on first use, so any check can also be run on its own.
	async function knownLabels() {
		if (labels.length === 0) {
			labels = await listedLabels(run.main);
		}
		return labels;
	}

	// The sort options stay open after one is chosen, so open them only when they are not showing.
	async function sortBy(option: string) {
		const choice = run.main.getByText(option, { exact: true });
		if (!(await choice.isVisible())) {
			await run.main.getByText('Sort by', { exact: true }).click();
		}
		await choice.click();
	}

	function rowOf(name: string) {
		return labelRows(run.main).filter({ has: run.page.getByRole('checkbox', { name, exact: true }) });
	}

	// The page remembers how the labels were last sorted, so the labels are compared whatever their order.
	async function expectLabelsUnchanged() {
		const expected = [...(await knownLabels())].sort((a, b) => byName(a.name, b.name));
		await reopenTab(run.page, run.tab);
		expect([...(await listedLabels(run.main))].sort((a, b) => byName(a.name, b.name))).toEqual(expected);
	}

	test('Open the Labels tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
		labels = await listedLabels(run.main);
		test.info().annotations.push({ type: 'labels', description: labels.map((label) => `${label.name} (${label.linked})`).join(', ') });
		expect(labels.length, 'labels listed').toBeGreaterThan(0);
		await expect(run.main.getByText(`All (${labels.length})`, { exact: true })).toBeVisible();
		for (const label of labels) {
			expect.soft(Number.isInteger(label.linked), `linked entities of ${label.name} is a count`).toBe(true);
		}
	});

	test('Search the labels', async () => {
		const search = run.main.getByRole('textbox', { name: 'Search', exact: true });
		const all = await knownLabels();
		const [first] = all;
		const matching = all.filter((label) => label.name.toLowerCase().includes(first.name.toLowerCase()));
		await searchFor(search, first.name, async () => {
			await expect.poll(async () => (await listedLabels(run.main)).map((label) => label.name).sort(byName), { message: 'labels matching the search', timeout: searchAttemptTime })
				.toEqual(matching.map((label) => label.name).sort(byName));
		});
		await search.fill('zz-no-such-label');
		await expect(run.main.getByText(noResults, { exact: true })).toBeVisible({ timeout: searchTime });
		await expect(run.main.getByRole('img', { name: 'Empty state illustration' })).toBeVisible();
		await expect(labelRows(run.main)).toHaveCount(0);
		await search.clear();
		await expect.poll(() => listedLabels(run.main), { timeout: searchTime }).toEqual(all);
	});

	test('Sort the labels', async () => {
		await expectMenuOptions(run.main, () => run.main.getByText('Sort by', { exact: true }).click(), sortOptions);
		const names = (await knownLabels()).map((label) => label.name);
		await sortBy('Z to A');
		await expect.poll(async () => (await listedLabels(run.main)).map((label) => label.name)).toEqual([...names].sort(byName).reverse());
		// A to Z is how the labels are listed at first, so the list is left that way.
		await sortBy('A to Z');
		await expect.poll(async () => (await listedLabels(run.main)).map((label) => label.name)).toEqual([...names].sort(byName));
	});

	test('Filter the labels by whether they are linked', async () => {
		const labels = await knownLabels();
		const linked = labels.filter((label) => label.linked > 0).map((label) => label.name).sort(byName);
		const notLinked = labels.filter((label) => label.linked === 0).map((label) => label.name).sort(byName);
		await run.main.getByText('Saved Filters', { exact: true }).click();
		await expect(run.main.getByText('Pre-defined filters', { exact: true })).toBeVisible();
		await run.main.getByText('Linked', { exact: true }).click();
		// The filter in use takes the place of "Saved Filters".
		await expect(run.main.getByText('Saved Filters', { exact: true })).toHaveCount(0);
		await expect.poll(async () => (await listedLabels(run.main)).map((label) => label.name).sort(byName)).toEqual(linked);

		await reopenTab(run.page, run.tab);
		await run.main.getByText('Saved Filters', { exact: true }).click();
		await run.main.getByText('Not Linked', { exact: true }).click();
		await expect(run.main.getByText('Saved Filters', { exact: true })).toHaveCount(0);
		if (notLinked.length === 0) {
			await expect(run.main.getByText('No labels have been added yet!', { exact: true })).toBeVisible();
			await expect(run.main.getByRole('button', { name: 'Add New Label' }).last()).toBeVisible();
		} else {
			await expect.poll(async () => (await listedLabels(run.main)).map((label) => label.name).sort(byName)).toEqual(notLinked);
		}
		await reopenTab(run.page, run.tab);
	});

	test('Start a new label and abandon it', async () => {
		const add = run.main.getByRole('button', { name: 'Add New Label' });
		await add.click();
		// The new label is a row of its own at the top, waiting for a name.
		const name = run.main.getByRole('grid').getByRole('textbox');
		await expect(name).toBeVisible();
		await expect(name).toBeEmpty();
		await expect(add).toBeDisabled();
		await expect(labelRows(run.main).first().getByRole('button', { name: '--' })).toBeDisabled();
		await name.fill('Playwright label that is never saved');
		await name.press('Escape');
		await expect(run.main.getByRole('grid').getByRole('textbox')).toHaveCount(0);
		await expect(add).toBeEnabled();
		await expectLabelsUnchanged();
	});

	test('Start editing a label and abandon it', async () => {
		const [first] = await knownLabels();
		const row = rowOf(first.name);
		await row.hover();
		// Hovering a label shows its edit and delete icons.
		await expect(row.getByTestId('edit-pencil')).toBeVisible();
		await expect(row.getByTestId('delete')).toBeVisible();
		await row.getByTestId('edit-pencil').click();
		const name = row.getByRole('textbox');
		await expect(name).toHaveValue(first.name);
		await name.press('Escape');
		await expect(row.getByRole('textbox')).toHaveCount(0);
		await expect(row.getByText(first.name, { exact: true })).toBeVisible();
		await expectLabelsUnchanged();
	});

	test('Select labels and clear the selection', async () => {
		const labels = await knownLabels();
		const [first] = labels;
		const total = labels.length;
		await rowOf(first.name).getByRole('checkbox').locator('..').click();
		await expect(rowOf(first.name).getByRole('checkbox')).toBeChecked();
		await expect(run.main.getByText('1 Labels selected', { exact: true })).toBeVisible();
		await expect(run.main.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
		// Selecting all from there picks every label, not only those shown.
		await run.main.getByRole('button', { name: `Select all ${total} Labels` }).click();
		await expect(run.main.getByText(`All ${total} Labels are selected`, { exact: true })).toBeVisible();
		await expect(run.main.getByRole('checkbox', { name: 'Select All' })).toBeChecked();
		for (const label of labels) {
			await expect.soft(rowOf(label.name).getByRole('checkbox'), label.name).toBeChecked();
		}
		await run.main.getByRole('button', { name: 'Clear Selection' }).click();
		await expect(run.main.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
		await expect(run.main.getByRole('checkbox', { name: 'Select All' })).not.toBeChecked();
		await expect(rowOf(first.name).getByRole('checkbox')).not.toBeChecked();
	});

	test('Select All selects every label', async () => {
		await run.main.getByRole('checkbox', { name: 'Select All' }).locator('..').click();
		const total = (await knownLabels()).length;
		await expect(run.main.getByText(`All ${total} Labels are selected`, { exact: true })).toBeVisible();
		await expect(run.main.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
		await run.main.getByRole('button', { name: 'Clear Selection' }).click();
		await expect(run.main.getByRole('checkbox', { name: 'Select All' })).not.toBeChecked();
		await expectLabelsUnchanged();
	});

	test('Open a label\'s linked entities', async () => {
		const labels = await knownLabels();
		const label = labels.find((item) => item.linked > 0) ?? labels[0];
		await rowOf(label.name).getByRole('button', { name: String(label.linked), exact: true }).click();
		const popup = run.page.getByRole('dialog');
		await expect(popup.getByText('Linked Entities', { exact: true })).toBeVisible();
		for (const kind of entityKinds) {
			// Each kind of entity is a tab showing how many of them use the label, e.g. "Test Plans (1)".
			const tab = popup.getByText(new RegExp(`^${kind}\\s*\\(\\d+\\)$`));
			await tab.click();
			const count = Number((await tab.innerText()).match(/\((\d+)\)/)![1]);
			test.info().annotations.push({ type: 'linked entities', description: `${label.name}: ${kind} (${count})` });
			if (count === 0) {
				await expect.soft(popup.getByText(`No Entities Found for ${kind}!`, { exact: true }), kind).toBeVisible();
			} else {
				await expect.soft(popup.getByRole('grid').getByRole('row').first(), kind).toBeVisible();
				await expect.soft(popup.getByText('Select All', { exact: true }), kind).toBeVisible();
			}
		}
		await popup.getByRole('button', { name: 'Okay' }).click();
		await expect(popup).toHaveCount(0);
	});
});
