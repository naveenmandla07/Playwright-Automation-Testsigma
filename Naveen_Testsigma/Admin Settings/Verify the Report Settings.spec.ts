/**
 * The Report Settings tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Report Settings tab and check its elements.
 * - Check the Customise Reports preference: its title, description and switch, noting whether it is on or off.
 *
 * Customising reports applies to the whole account as soon as it is switched, so the switch is only looked at.
 */
import { expect, test } from '@playwright/test';
import { expectTabElements, openTab, useSettingsTab } from '../support/admin-settings';

test.describe('Verify the Report Settings', () => {
	const run = useSettingsTab('Report Settings');

	test('Open the Report Settings tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
	});

	test('Check the Customise Reports preference', async () => {
		await expect(run.main.getByText('Customise Reports', { exact: true })).toBeVisible();
		await expect(run.main.getByRole('paragraph').filter({ hasText: /^Export customised reports/ }))
			.toHaveText('Export customised reports for your company by adding a logo, including copyright information, and sharing them with your brand identity.');
		// The preference is turned on or off by its switch, drawn over the checkbox that names it.
		const customise = run.main.getByRole('checkbox', { name: 'Customise Reports', exact: true });
		await expect(customise).toBeAttached();
		await expect(customise).toBeEnabled();
		await expect(customise.locator('..').getByTestId('toggle-switch')).toBeVisible();
		test.info().annotations.push({ type: 'customise reports', description: (await customise.isChecked()) ? 'on' : 'off' });
	});
});
