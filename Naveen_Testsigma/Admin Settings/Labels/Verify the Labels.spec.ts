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
import { expect, test } from '@playwright/test';
import { searchAttemptTime, searchTime } from '../../pages/settings/SettingsPage';
import { LabelsTab, type Label } from '../../pages/settings/tabs/LabelsTab';
import { useSettingsTab } from '../../support/admin-settings';
import { byName, noResults } from '../../support/common';

const sortOptions = ['Label Name', 'Created Date', 'Updated Date', 'A to Z', 'Z to A'];
const entityKinds = ['Test Cases', 'Step Groups', 'Test Suites', 'Test Plans', 'Elements'];

test.describe('Verify the Labels', () => {
	const run = useSettingsTab(LabelsTab);
	// The labels as first listed, which every check leaves as they were.
	let labels: Label[] = [];

	// Reads the labels on first use, so any check can also be run on its own.
	async function knownLabels() {
		if (labels.length === 0) {
			labels = await run.tab.listedLabels();
		}
		return labels;
	}

	// The page remembers how the labels were last sorted, so the labels are compared whatever their order.
	async function expectLabelsUnchanged() {
		const expected = [...(await knownLabels())].sort((a, b) => byName(a.name, b.name));
		await run.tab.reopen();
		expect([...(await run.tab.listedLabels())].sort((a, b) => byName(a.name, b.name))).toEqual(expected);
	}

	test('Open the Labels tab and check its elements', async () => {
		await run.tab.open();
		await run.tab.expectElements();
		labels = await run.tab.listedLabels();
		test.info().annotations.push({ type: 'labels', description: labels.map((label) => `${label.name} (${label.linked})`).join(', ') });
		expect(labels.length, 'labels listed').toBeGreaterThan(0);
		await expect(run.tab.text(`All (${labels.length})`)).toBeVisible();
		for (const label of labels) {
			expect.soft(Number.isInteger(label.linked), `linked entities of ${label.name} is a count`).toBe(true);
		}
	});

	test('Search the labels', async () => {
		const search = run.tab.search;
		const all = await knownLabels();
		const [first] = all;
		const matching = all.filter((label) => label.name.toLowerCase().includes(first.name.toLowerCase()));
		await run.tab.searchFor(search, first.name, async () => {
			await expect.poll(async () => (await run.tab.listedLabels()).map((label) => label.name).sort(byName), { message: 'labels matching the search', timeout: searchAttemptTime })
				.toEqual(matching.map((label) => label.name).sort(byName));
		});
		await search.fill('zz-no-such-label');
		await expect(run.tab.text(noResults)).toBeVisible({ timeout: searchTime });
		await expect(run.tab.emptyState).toBeVisible();
		await expect(run.tab.rows).toHaveCount(0);
		await search.clear();
		await expect.poll(() => run.tab.listedLabels(), { timeout: searchTime }).toEqual(all);
	});

	test('Sort the labels', async () => {
		await run.tab.expectMenuOptions(() => run.tab.sortByLabel.click(), sortOptions);
		const names = (await knownLabels()).map((label) => label.name);
		await run.tab.sortBy('Z to A');
		await expect.poll(async () => (await run.tab.listedLabels()).map((label) => label.name)).toEqual([...names].sort(byName).reverse());
		// A to Z is how the labels are listed at first, so the list is left that way.
		await run.tab.sortBy('A to Z');
		await expect.poll(async () => (await run.tab.listedLabels()).map((label) => label.name)).toEqual([...names].sort(byName));
	});

	test('Filter the labels by whether they are linked', async () => {
		const labels = await knownLabels();
		const linked = labels.filter((label) => label.linked > 0).map((label) => label.name).sort(byName);
		const notLinked = labels.filter((label) => label.linked === 0).map((label) => label.name).sort(byName);
		await run.tab.savedFilters.click();
		await expect(run.tab.text('Pre-defined filters')).toBeVisible();
		await run.tab.text('Linked').click();
		// The filter in use takes the place of "Saved Filters".
		await expect(run.tab.savedFilters).toHaveCount(0);
		await expect.poll(async () => (await run.tab.listedLabels()).map((label) => label.name).sort(byName)).toEqual(linked);

		await run.tab.reopen();
		await run.tab.savedFilters.click();
		await run.tab.text('Not Linked').click();
		await expect(run.tab.savedFilters).toHaveCount(0);
		if (notLinked.length === 0) {
			await expect(run.tab.text('No labels have been added yet!')).toBeVisible();
			await expect(run.tab.addLabelButton.last()).toBeVisible();
		} else {
			await expect.poll(async () => (await run.tab.listedLabels()).map((label) => label.name).sort(byName)).toEqual(notLinked);
		}
		await run.tab.reopen();
	});

	test('Start a new label and abandon it', async () => {
		const add = run.tab.addLabelButton;
		await add.click();
		// The new label is a row of its own at the top, waiting for a name.
		const name = run.tab.nameBox;
		await expect(name).toBeVisible();
		await expect(name).toBeEmpty();
		await expect(add).toBeDisabled();
		await expect(run.tab.rows.first().getByRole('button', { name: '--' })).toBeDisabled();
		await name.fill('Playwright label that is never saved');
		await name.press('Escape');
		await expect(run.tab.nameBox).toHaveCount(0);
		await expect(add).toBeEnabled();
		await expectLabelsUnchanged();
	});

	test('Start editing a label and abandon it', async () => {
		const [first] = await knownLabels();
		const row = run.tab.rowOf(first.name);
		await row.hover();
		// Hovering a label shows its edit and delete icons.
		await expect(run.tab.editIcon(row)).toBeVisible();
		await expect(run.tab.deleteIcon(row)).toBeVisible();
		await run.tab.editIcon(row).click();
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
		await run.tab.tick(run.tab.checkboxOf(first.name));
		await expect(run.tab.checkboxOf(first.name)).toBeChecked();
		await expect(run.tab.text('1 Labels selected')).toBeVisible();
		await expect(run.tab.deleteButton).toBeVisible();
		// Selecting all from there picks every label, not only those shown.
		await run.tab.selectAllLabels(total).click();
		await expect(run.tab.text(`All ${total} Labels are selected`)).toBeVisible();
		await expect(run.tab.selectAll).toBeChecked();
		for (const label of labels) {
			await expect.soft(run.tab.checkboxOf(label.name), label.name).toBeChecked();
		}
		await run.tab.clearSelectionButton.click();
		await expect(run.tab.deleteButton).toHaveCount(0);
		await expect(run.tab.selectAll).not.toBeChecked();
		await expect(run.tab.checkboxOf(first.name)).not.toBeChecked();
	});

	test('Select All selects every label', async () => {
		await run.tab.tick(run.tab.selectAll);
		const total = (await knownLabels()).length;
		await expect(run.tab.text(`All ${total} Labels are selected`)).toBeVisible();
		await expect(run.tab.deleteButton).toBeVisible();
		await run.tab.clearSelectionButton.click();
		await expect(run.tab.selectAll).not.toBeChecked();
		await expectLabelsUnchanged();
	});

	test('Open a label\'s linked entities', async () => {
		const labels = await knownLabels();
		const label = labels.find((item) => item.linked > 0) ?? labels[0];
		const popup = await run.tab.openLinkedEntities(label);
		await expect(popup.text('Linked Entities')).toBeVisible();
		for (const kind of entityKinds) {
			const tab = popup.kindTab(kind);
			await tab.click();
			const count = Number((await tab.innerText()).match(/\((\d+)\)/)![1]);
			test.info().annotations.push({ type: 'linked entities', description: `${label.name}: ${kind} (${count})` });
			if (count === 0) {
				await expect.soft(popup.text(`No Entities Found for ${kind}!`), kind).toBeVisible();
			} else {
				await expect.soft(popup.firstRow, kind).toBeVisible();
				await expect.soft(popup.text('Select All'), kind).toBeVisible();
			}
		}
		await popup.okayButton.click();
		await expect(popup.root).toHaveCount(0);
	});
});
