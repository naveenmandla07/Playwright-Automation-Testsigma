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
import { ReportSettingsTab } from '../../pages/settings/tabs/ReportSettingsTab';
import { useSettingsTab } from '../../support/admin-settings';

test.describe('Verify the Report Settings', () => {
	const run = useSettingsTab(ReportSettingsTab);

	test('Open the Report Settings tab and check its elements', async () => {
		await run.tab.open();
		await run.tab.expectElements();
	});

	test('Check the Customise Reports preference', async () => {
		await expect(run.tab.text('Customise Reports')).toBeVisible();
		await expect(run.tab.description)
			.toHaveText('Export customised reports for your company by adding a logo, including copyright information, and sharing them with your brand identity.');
		// The preference is turned on or off by its switch, drawn over the checkbox that names it.
		const customise = run.tab.customise;
		await expect(customise).toBeAttached();
		await expect(customise).toBeEnabled();
		await expect(customise.locator('..').getByTestId('toggle-switch')).toBeVisible();
		test.info().annotations.push({ type: 'customise reports', description: (await customise.isChecked()) ? 'on' : 'off' });
	});
});
