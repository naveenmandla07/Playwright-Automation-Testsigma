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
import { expect, test } from '@playwright/test';
import { CustomFieldsTab } from '../../pages/settings/tabs/CustomFieldsTab';
import { useSettingsTab } from '../../support/admin-settings';

const fieldTypes = ['Text field', 'Dropdown select', 'Checkbox', 'Radio button', 'Date picker', 'Text area', 'URL', 'Number field'];
// Field types that choose from a list of options, which the form asks for.
const withOptions = ['Dropdown select', 'Checkbox', 'Radio button'];

test.describe('Verify the Custom Fields', () => {
	const run = useSettingsTab(CustomFieldsTab);

	test('Open the Custom Fields tab and check its elements', async () => {
		await run.tab.open();
		await run.tab.expectElements();
		const fields = await run.tab.listedFields();
		// The fields shown are the test cases' own, counted beside the heading.
		await expect(run.tab.fieldCount(fields.length)).toBeVisible();
	});

	test('Check every field listed', async () => {
		const fields = await run.tab.listedFields();
		for (const [index, field] of fields.entries()) {
			expect.soft(field.name, `name of field ${index + 1}`).toMatch(/\S/);
			expect.soft(fieldTypes, `type of ${field.name}`).toContain(field.type);
			test.info().annotations.push({ type: 'field', description: `${field.name}: ${field.type}` });
			const row = run.tab.rows.nth(index);
			await row.hover();
			await expect.soft(run.tab.editIcon(row), `edit icon of ${field.name}`).toBeVisible();
			await expect.soft(run.tab.deleteIcon(row), `delete icon of ${field.name}`).toBeVisible();
		}
	});

	test('Open the Add new field form and check its fields', async () => {
		const tab = run.tab;
		await tab.openAddForm();
		await expect(tab.formHeading('Add new field in Test Case')).toBeVisible();
		await expect(tab.nameField).toBeEmpty();
		await expect(tab.formText('Description')).toBeVisible();
		await expect(tab.descriptionField).toBeEmpty();
		// A new field is a text field until another type is chosen.
		await expect(tab.fieldType).toContainText('Text field');
		await expect(tab.configureOptions).toHaveCount(0);
		await expect(tab.formButton('Add')).toBeDisabled();
		await expect(tab.formButton('Cancel')).toBeEnabled();
		await tab.cancelForm();
	});

	test('Every field type is offered', async () => {
		await run.tab.openAddForm();
		// The list opens from the type chosen, whose text it repeats.
		await run.tab.expectMenuOptions(() => run.tab.formText('Text field').click(), fieldTypes, run.tab.form);
		await run.tab.cancelForm();
	});

	for (const type of withOptions) {
		test(`A ${type} field asks for its options`, async () => {
			await run.tab.openAddForm();
			await run.tab.chooseType('Text field', type);
			await expect(run.tab.configureOptions).toBeVisible();
			await expect(run.tab.formText('Press Enter to save')).toBeVisible();
			await run.tab.cancelForm();
		});
	}

	test('A field can be added once it has a name', async () => {
		const tab = run.tab;
		await tab.openAddForm();
		await tab.nameField.fill('Playwright field that is never added');
		await expect(tab.formButton('Add')).toBeEnabled();
		await tab.nameField.clear();
		await expect(tab.formButton('Add')).toBeDisabled();
		await tab.cancelForm();
	});

	test('A field\'s edit form holds the field as it is', async () => {
		const tab = run.tab;
		const [field] = await tab.listedFields();
		await tab.openEditForm(tab.rows.first());
		await expect(tab.formHeading('Edit field in Test Case')).toBeVisible();
		await expect(tab.nameField).toHaveValue(field.name);
		await expect(tab.fieldType).toContainText(field.type);
		if (withOptions.includes(field.type)) {
			// Its options are listed, each as a button, with a box to add another.
			await expect(tab.configureOptions).toBeVisible();
			await expect(tab.optionButtons.first()).toBeVisible();
		}
		// Nothing has changed yet, so there is nothing to update.
		await expect(tab.formButton('Update')).toBeDisabled();
		await tab.cancelForm();
		expect(await tab.listedFields()).toContainEqual(field);
	});
});
