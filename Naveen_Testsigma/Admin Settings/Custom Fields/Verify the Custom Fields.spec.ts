/**
 * The Custom Fields tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Custom Fields tab and check its elements, and that the test case count matches the fields listed.
 * - Check every field listed has a name and one of the field types, and shows edit and delete icons on hovering.
 * - Open "Add new field" and check the form: its name, description and field type, every field type offered, the
 *   options asked for by the types that choose from options, and that a field can be added once it has a name.
 * - Open a field's edit form, check it holds the field as it is, and cancel it.
 *
 * Nothing is saved: "Add" and "Update" are checked but never clicked, every form is cancelled, and the delete icon is
 * never clicked. The fields belong to the account, so they are read from the page.
 */
import { expect, test, type Locator } from '@playwright/test';
import { expectMenuOptions, expectTabElements, openTab, useSettingsTab } from '../../support/admin-settings';

const fieldTypes = ['Text field', 'Dropdown select', 'Checkbox', 'Radio button', 'Date picker', 'Text area', 'URL', 'Number field'];
// Field types that choose from a list of options, which the form asks for.
const withOptions = ['Dropdown select', 'Checkbox', 'Radio button'];

// Each field is a row inside the grid's own wrapping row.
function fieldRows(main: Locator) {
	return main.getByRole('grid').getByRole('row').getByRole('row');
}

async function listedFields(main: Locator) {
	return Promise.all((await fieldRows(main).all()).map(async (row) => {
		const cells = row.getByRole('gridcell');
		return { name: (await cells.nth(0).innerText()).trim(), type: (await cells.nth(1).innerText()).trim() };
	}));
}

test.describe('Verify the Custom Fields', () => {
	const run = useSettingsTab('Custom Fields');

	function fieldForm() {
		return run.page.getByRole('dialog');
	}

	// The chosen field type is shown beside its label.
	function fieldType() {
		return fieldForm().getByText('Field Type', { exact: true }).locator('xpath=..');
	}

	async function openAddForm() {
		await run.main.getByRole('button', { name: 'Add new field' }).click();
		await expect(fieldForm().getByRole('textbox', { name: 'Field Name' })).toBeVisible();
	}

	// The field type is chosen from a list that opens under the one chosen.
	async function chooseType(current: string, type: string) {
		await fieldForm().getByText(current, { exact: true }).click();
		await fieldForm().getByText(type, { exact: true }).last().click();
		await expect(fieldType()).toContainText(type);
	}

	async function cancelForm() {
		await fieldForm().getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(fieldForm()).toHaveCount(0);
	}

	test('Open the Custom Fields tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
		const fields = await listedFields(run.main);
		// The fields shown are the test cases' own, counted beside the heading.
		await expect(run.main.getByText(new RegExp(`^Test Case\\s*\\(${fields.length}\\)$`))).toBeVisible();
	});

	test('Check every field listed', async () => {
		const fields = await listedFields(run.main);
		for (const [index, field] of fields.entries()) {
			expect.soft(field.name, `name of field ${index + 1}`).toMatch(/\S/);
			expect.soft(fieldTypes, `type of ${field.name}`).toContain(field.type);
			test.info().annotations.push({ type: 'field', description: `${field.name}: ${field.type}` });
			const row = fieldRows(run.main).nth(index);
			await row.hover();
			await expect.soft(row.getByTestId('edit-pencil'), `edit icon of ${field.name}`).toBeVisible();
			await expect.soft(row.getByTestId('delete'), `delete icon of ${field.name}`).toBeVisible();
		}
	});

	test('Open the Add new field form and check its fields', async () => {
		await openAddForm();
		const form = fieldForm();
		await expect(form.getByRole('paragraph').filter({ hasText: 'Add new field in Test Case' })).toBeVisible();
		await expect(form.getByRole('textbox', { name: 'Field Name' })).toBeEmpty();
		await expect(form.getByText('Description', { exact: true })).toBeVisible();
		await expect(form.getByRole('textbox').nth(1)).toBeEmpty();
		// A new field is a text field until another type is chosen.
		await expect(fieldType()).toContainText('Text field');
		await expect(form.getByText('Configure Options*', { exact: true })).toHaveCount(0);
		await expect(form.getByRole('button', { name: 'Add', exact: true })).toBeDisabled();
		await expect(form.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
		await cancelForm();
	});

	test('Every field type is offered', async () => {
		await openAddForm();
		await expectMenuOptions(fieldForm(), () => fieldForm().getByText('Text field', { exact: true }).click(), fieldTypes);
		await cancelForm();
	});

	for (const type of withOptions) {
		test(`A ${type} field asks for its options`, async () => {
			await openAddForm();
			await chooseType('Text field', type);
			await expect(fieldForm().getByText('Configure Options*', { exact: true })).toBeVisible();
			await expect(fieldForm().getByText('Press Enter to save', { exact: true })).toBeVisible();
			await cancelForm();
		});
	}

	test('A field can be added once it has a name', async () => {
		await openAddForm();
		const add = fieldForm().getByRole('button', { name: 'Add', exact: true });
		await fieldForm().getByRole('textbox', { name: 'Field Name' }).fill('Playwright field that is never added');
		await expect(add).toBeEnabled();
		await fieldForm().getByRole('textbox', { name: 'Field Name' }).clear();
		await expect(add).toBeDisabled();
		await cancelForm();
	});

	test('A field\'s edit form holds the field as it is', async () => {
		const [field] = await listedFields(run.main);
		const row = fieldRows(run.main).first();
		await row.hover();
		await row.getByTestId('edit-pencil').click();
		const form = fieldForm();
		await expect(form.getByRole('paragraph').filter({ hasText: 'Edit field in Test Case' })).toBeVisible();
		await expect(form.getByRole('textbox', { name: 'Field Name' })).toHaveValue(field.name);
		await expect(fieldType()).toContainText(field.type);
		if (withOptions.includes(field.type)) {
			// Its options are listed, each as a button, with a box to add another.
			await expect(form.getByText('Configure Options*', { exact: true })).toBeVisible();
			await expect(form.getByRole('button').filter({ hasNotText: /^(Cancel|Update)$/ }).first()).toBeVisible();
		}
		// Nothing has changed yet, so there is nothing to update.
		await expect(form.getByRole('button', { name: 'Update', exact: true })).toBeDisabled();
		await cancelForm();
		expect(await listedFields(run.main)).toContainEqual(field);
	});
});
