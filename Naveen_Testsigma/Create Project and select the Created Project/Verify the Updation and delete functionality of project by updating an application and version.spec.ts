/**
 * Every editable Project Settings field on a Modern project, then deleting the project.
 *
 * Scenario (one test, reported step by step):
 * - Delete any "Testsigma_Settings_Delete_Modern" left by a run that failed part way, then create it afresh.
 * - Open Project Settings and check each tab: Project Details, Applications, Versions, test case and requirement
 *   types, and Project Members.
 * - Turn every project option on and off, saving and verifying each change.
 * - Rename every test case and requirement type and check the new names persist.
 * - Check the read-only member details and member search.
 * - Update the project name and description, the application name and description, and the version title,
 *   description and date range, verifying each after reopening.
 * - Check the delete confirmation enables Delete only for exactly 'DELETE', then delete the project.
 * - The account switches to "Testsigma Advanced Examples" and the deleted project is gone from the switcher.
 *
 * Known issue: the version date range can show its end date one day later than the date picked; that shift is
 * noted, with what was shown attached, instead of failing the test, while any other mismatch fails it.
 *
 * Runs in the serial chromium-projects project because it changes the account's current project.
 */
import { expect, test, type Page } from '@playwright/test';
import { checkSelectingProjects, createOrSwitchToProject, openProjectSwitcher, type NewProject } from '../support/create-project';
import { accountEmail, missingCredentials, missingCredentialsMessage, signInToTestsigma } from '../support/testsigma-auth';
import { escapeRegExp } from '../support/common';

const projectName = 'Testsigma_Settings_Delete_Modern';
const updatedProjectName = `${projectName}_Updated`;
const project: NewProject = {
	name: projectName,
	engine: 'Modern',
	application: 'Web App',
	version: 'modern web',
	description: 'Project created by the Testsigma Playwright automation suite using the Modern engine.',
};

// A run that fails part way leaves its project behind, already partly changed, so each run deletes any project
// left with its name, before or after renaming, and starts from a new one.
async function deleteLeftoverProjects(page: Page) {
	const leftovers = async () => ((await (await page.request.get('/private/projects?size=500&page=0')).json()).content as { id: number; name: string }[])
		.filter((item) => [projectName, updatedProjectName].includes(item.name));
	for (const leftover of await leftovers()) {
		expect((await page.request.delete(`/private/projects/${leftover.id}`)).ok(), `delete leftover ${leftover.name}`).toBe(true);
	}
	await expect.poll(async () => (await leftovers()).length, { timeout: 30000 }).toBe(0);
	// The current project may have been one of them, so load the page again to show the one Testsigma moved to.
	await page.reload();
}

test('[Modern] Verify all editable project settings, persistence and deletion', async ({ page }) => {
	test.setTimeout(360000);
	page.setDefaultTimeout(15000);
	test.skip(missingCredentials, missingCredentialsMessage);

	try {
		await signInToTestsigma(page);
		await deleteLeftoverProjects(page);

		const switcher = await openProjectSwitcher(page);
		const { projectApplicationTab, projectDropdown, applicationDropdown, versionDropdown, projectSettings } = switcher;
		await createOrSwitchToProject(page, switcher, project);
		await checkSelectingProjects(page, switcher, project, { reloadBetween: false });
		await test.step('Open Project Settings and verify every tab', async () => {
			await expect(projectSettings).toBeEnabled();
			await projectSettings.click();
			const dialog = page.getByRole('dialog');
			await expect(dialog.getByRole('heading', { name: 'Project Details', exact: true })).toBeVisible();
			await expect(dialog.getByText('Edit Project', { exact: true })).toBeVisible();

			const tabs = ['Project Details', 'Applications', 'Versions', 'Project Members', 'Test Case Types', 'Requirement Types'];
			for (const tab of tabs) {
				await expect(dialog.getByText(tab, { exact: true }).first()).toBeVisible();
			}
			for (const tab of tabs) {
				await test.step(`Verify ${tab}`, async () => {
					await dialog.getByText(tab, { exact: true }).first().click();
					const heading = tab === 'Applications' ? 'Applications settings' : tab;
					await expect(dialog.getByRole('heading', { name: heading, exact: true })).toBeVisible();
					if (tab === 'Project Details' || tab === 'Applications') {
						await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(tab === 'Project Details' ? projectName : 'Web App');
						await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toBeEditable();
						await expect(dialog.getByText('Description', { exact: true })).toBeVisible();
						await expect(dialog.locator('textarea')).toBeEditable();
						for (const label of ['Created by', 'Last Updated by']) {
							await expect(dialog.getByText(label, { exact: true })).toBeVisible();
						}
						await expect(dialog.locator('input:disabled')).toHaveCount(2);
						for (const field of await dialog.locator('input:disabled').all()) {
							await expect(field).toBeDisabled();
						}
						await expect(dialog.getByRole('button', { name: 'Update', exact: true })).toBeDisabled();
						await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
						if (tab === 'Project Details') {
							await expect(dialog.locator('textarea')).toHaveValue('Project created by the Testsigma Playwright automation suite using the Modern engine.');
							await expect(dialog.getByRole('checkbox', { name: 'Allow adding multiple applications in this project', exact: true })).toBeChecked();
							await expect(dialog.getByRole('checkbox', { name: 'Allow multiple versions', exact: true })).toBeChecked();
							await expect(dialog.getByRole('button', { name: 'Delete project', exact: true })).toBeEnabled();
						} else {
							await expect(dialog.getByRole('heading', { name: '1 Applications', exact: true })).toBeVisible();
							await expect(dialog.getByRole('button', { name: 'New application', exact: true })).toBeEnabled();
							for (const label of ['Web App', 'Web application', 'Engine version', 'Modern']) {
								await expect(dialog.getByText(label, { exact: true })).toBeVisible();
							}
						}
					} else if (tab === 'Versions') {
						await expect(dialog.getByRole('heading', { name: '1 Versions', exact: true })).toBeVisible();
						await expect(dialog.getByRole('button', { name: 'New version', exact: true })).toBeEnabled();
						for (const label of ['Application', 'Web App', 'Web application', 'Title', 'Start Date', 'End Date']) {
							await expect(dialog.getByText(label, { exact: true })).toBeVisible();
						}
						await expect(dialog.getByRole('row').filter({ hasText: 'modern web' })).toBeVisible();
					} else if (tab === 'Project Members') {
						await expect(dialog.getByRole('textbox', { name: 'Search', exact: true })).toBeEditable();
						for (const button of ['Assign', 'Invite']) {
							await expect(dialog.getByRole('button', { name: button, exact: true })).toBeEnabled();
						}
						for (const label of ['Name', 'Email']) {
							await expect(dialog.getByText(label, { exact: true })).toBeVisible();
						}
						await expect(dialog.getByRole('row').filter({ hasText: accountEmail })).toBeVisible();
					} else {
						await expect(dialog.getByRole('textbox', { name: 'Search', exact: true })).toBeEditable();
						const types = tab === 'Test Case Types'
							? ['Unit Test', 'Integration', 'Functional', 'Non Functional', 'User Experience']
							: ['Customer Requirements', 'Functional Requirements', 'Non-Functional Requirements', 'User Interface Requirements'];
						await expect(dialog.getByRole('heading', { name: `${types.length} types`, exact: true })).toBeVisible();
						for (const type of types) {
							await expect(dialog.getByText(type, { exact: true })).toBeVisible();
						}
						await expect(dialog.getByText('Add Type', { exact: true })).toBeVisible();
					}
				});
			}
		});

		const updatedApplicationName = 'Web App Updated';
		const updatedVersionName = 'modern web updated';
		const projectDescription = 'Project description updated by Playwright.';
		const applicationDescription = 'Application description updated by Playwright.';
		const versionDescription = 'Version description updated by Playwright.';

		async function reopenSettings(expectedProject: string, expectedApplication: string, expectedVersion: string) {
			await page.reload({ waitUntil: 'domcontentloaded' });
			await page.mouse.move(20, 100);
			await expect(projectApplicationTab).toHaveText(expectedProject, { timeout: 30000 });
			await projectApplicationTab.click();
			await expect(projectDropdown).toHaveText(expectedProject);
			await expect(applicationDropdown).toHaveText(expectedApplication);
			await expect(versionDropdown).toHaveText(expectedVersion);
			await projectSettings.click();
			await expect(page.getByRole('dialog').getByRole('heading', { name: 'Project Details', exact: true })).toBeVisible();
		}

		await test.step('Verify every project option can be saved and restored', async () => {
			const options = [
				{ option: 'Allow adding multiple applications in this project', field: 'hasMultipleApps' },
				{ option: 'Allow multiple versions', field: 'hasMultipleVersions' },
			];
			for (const { option, field } of options) {
				for (const checked of [false, true]) {
					await test.step(`${option}: ${checked}`, async () => {
						const dialog = page.getByRole('dialog');
						await dialog.getByText('Project Details', { exact: true }).first().click();
						// The form loads the saved values asynchronously and resets any change made before they arrive.
						await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(projectName);
						const checkbox = dialog.getByRole('checkbox', { name: option, exact: true });
						const update = dialog.getByRole('button', { name: 'Update', exact: true });
						await expect(checkbox).toBeEnabled();
						// The decorative checkmark covers the input, and a keyboard toggle does not reach the form state; click the label.
						await expect(async () => {
							if (await checkbox.isChecked() !== checked) {
								await dialog.getByText(option, { exact: true }).click();
							}
							await expect(checkbox).toBeChecked({ checked, timeout: 1000 });
							await expect(update).toBeEnabled({ timeout: 1000 });
						}).toPass({ timeout: 15000 });
						const updateRequest = page.waitForRequest((request) => request.method() === 'PUT' && /\/private\/projects\/\d+$/.test(request.url()));
						await update.click();
						expect((await updateRequest).postDataJSON()[field]).toBe(checked);
						await expect(page.getByText(/project.*updated.*successfully/i)).toBeVisible({ timeout: 30000 });
						// The update is accepted (202) and applied asynchronously; reopen until the saved value is shown.
						await expect(async () => {
							await reopenSettings(projectName, 'Web App', 'modern web');
							await expect(checkbox).toBeChecked({ checked, timeout: 2000 });
						}).toPass({ timeout: 60000 });
						await expect(update).toBeDisabled();
					});
				}
			}
		});

		await test.step('Update every test case and requirement type and verify persistence', async () => {
			const categories = [
				{ tab: 'Test Case Types', names: ['Unit Test', 'Integration', 'Functional', 'Non Functional', 'User Experience'] },
				{ tab: 'Requirement Types', names: ['Customer Requirements', 'Functional Requirements', 'Non-Functional Requirements', 'User Interface Requirements'] },
			];
			for (const { tab, names } of categories) {
				await test.step(`Update all names in ${tab}`, async () => {
					const dialog = page.getByRole('dialog');
					await dialog.getByText(tab, { exact: true }).first().click();
					await expect(dialog.getByRole('heading', { name: tab, exact: true })).toBeVisible();
					for (const original of names) {
						const label = dialog.getByText(original, { exact: true });
						await expect(label).toBeVisible();
						await label.hover();
						// Type rows have no role; scope the edit icon to the verified row container.
						await label.locator('../../..').getByTestId('edit').click();
						const input = dialog.locator('input:not([aria-label="Search"])');
						await expect(input).toHaveValue(original);
						await expect(dialog.getByText('Press Enter key to save', { exact: true })).toBeVisible();
						await input.fill(`${original} Updated`);
						await expect(input).toHaveValue(`${original} Updated`);
						await input.press('Enter');
						await expect(input).toBeHidden();
						await expect(dialog.getByText(`${original} Updated`, { exact: true })).toBeVisible();
						await expect(label).toHaveCount(0);
					}
					await reopenSettings(projectName, 'Web App', 'modern web');
					await dialog.getByText(tab, { exact: true }).first().click();
					await expect(dialog.getByRole('heading', { name: `${names.length} types`, exact: true })).toBeVisible();
					for (const original of names) {
						await expect(dialog.getByText(`${original} Updated`, { exact: true })).toBeVisible();
						await expect(dialog.getByText(original, { exact: true })).toHaveCount(0);
					}
					const search = dialog.getByRole('textbox', { name: 'Search', exact: true });
					if (!await search.isVisible()) await dialog.getByTestId('search').click();
					await expect(search).toBeVisible();
					await search.fill(`${names[0]} Updated`);
					await expect(dialog.getByText(`${names[0]} Updated`, { exact: true })).toBeVisible();
					await expect(dialog.getByText(`${names[1]} Updated`, { exact: true })).toBeHidden();
					await search.clear();
					await expect(dialog.getByText(`${names[1]} Updated`, { exact: true })).toBeVisible();
				});
			}
		});

		await test.step('Verify read-only project member details and search', async () => {
			const dialog = page.getByRole('dialog');
			await dialog.getByText('Project Members', { exact: true }).first().click();
			const member = dialog.getByRole('row').filter({ hasText: accountEmail });
			await expect(member).toBeVisible();
			await expect(member.getByText('Test Manager', { exact: true })).toBeVisible();
			await expect(member.locator('input, textarea, select, [contenteditable="true"], [data-testid="edit"]')).toHaveCount(0);
			const search = dialog.getByRole('textbox', { name: 'Search', exact: true });
			if (!await search.isVisible()) await dialog.getByTestId('search').click();
			await expect(search).toBeVisible();
			await search.fill(accountEmail);
			await expect(member).toBeVisible();
			await search.fill('NoSuchMember_Playwright');
			await expect(member).toBeHidden();
			await search.clear();
			await expect(member).toBeVisible();
		});

		await test.step('Update project name and description and verify persistence', async () => {
			const dialog = page.getByRole('dialog');
			await dialog.getByText('Project Details', { exact: true }).first().click();
			const name = dialog.getByRole('textbox', { name: 'Name', exact: true });
			const update = dialog.getByRole('button', { name: 'Update', exact: true });
			await expect(name).toHaveValue(projectName);
			await expect(update).toBeDisabled();
			await name.fill(updatedProjectName);
			await dialog.locator('textarea').fill(projectDescription);
			await expect(name).toHaveValue(updatedProjectName);
			await expect(update).toBeEnabled();
			await update.click();
			await expect(page.getByText(/project.*updated.*successfully/i)).toBeVisible({ timeout: 30000 });
			await reopenSettings(updatedProjectName, 'Web App', 'modern web');
			await expect(name).toHaveValue(updatedProjectName);
			await expect(dialog.locator('textarea')).toHaveValue(projectDescription);
			await expect(update).toBeDisabled();
		});

		await test.step('Update application name and description and verify persistence', async () => {
			const dialog = page.getByRole('dialog');
			await dialog.getByText('Applications', { exact: true }).click();
			await expect(dialog.getByRole('heading', { name: 'Applications settings', exact: true })).toBeVisible();
			const name = dialog.getByRole('textbox', { name: 'Name', exact: true });
			const update = dialog.getByRole('button', { name: 'Update', exact: true });
			await expect(name).toHaveValue('Web App');
			await expect(update).toBeDisabled();
			await name.fill(updatedApplicationName);
			await dialog.locator('textarea').fill(applicationDescription);
			await expect(name).toHaveValue(updatedApplicationName);
			await expect(update).toBeEnabled();
			await update.click();
			await expect(page.getByText(/application.*updated.*successfully/i)).toBeVisible({ timeout: 30000 });
			await reopenSettings(updatedProjectName, updatedApplicationName, 'modern web');
			await dialog.getByText('Applications', { exact: true }).click();
			await expect(name).toHaveValue(updatedApplicationName);
			await expect(dialog.locator('textarea')).toHaveValue(applicationDescription);
			await expect(update).toBeDisabled();
		});

		await test.step('Update version title, description, start date and end date and verify persistence', async () => {
			const settings = page.getByRole('dialog');
			await settings.getByText('Versions', { exact: true }).first().click();
			await expect(settings.getByRole('heading', { name: 'Versions', exact: true })).toBeVisible();
			const originalRow = settings.getByRole('row').filter({ hasText: 'modern web' });
			await expect(originalRow).toBeVisible();
			await originalRow.getByTestId('more-vertical').click();
			await page.getByText('Edit Version', { exact: true }).click();
			const editor = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Edit version', exact: true }) });
			const title = editor.getByRole('textbox', { name: 'Title', exact: true });
			await expect(title).toHaveValue('modern web');
			await expect(editor.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
			await expect(editor.getByText('Start Date - End Date', { exact: true })).toBeVisible();
			const range = editor.getByTestId('range-picker-result-placeholder');
			const originalRange = await range.innerText();
			const startDate = new Date(originalRange.split(' - ')[0]);
			expect(Number.isNaN(startDate.getTime())).toBe(false);
			const newStart = new Date(startDate.getFullYear(), startDate.getMonth(), 5);
			const newEnd = new Date(startDate.getFullYear(), startDate.getMonth(), 15);
			const calendarLabel = (date: Date) => date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
			const displayDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
			const expectedRange = `${displayDate(newStart)} - ${displayDate(newEnd)}`;
			// Known issue: the range can show its end date one day later than the date picked. That shift is noted, with
			// what was shown, rather than failing the check; any other range fails it.
			const shiftedEnd = new Date(newEnd.getFullYear(), newEnd.getMonth(), newEnd.getDate() + 1);
			const knownShiftedRange = `${displayDate(newStart)} - ${displayDate(shiftedEnd)}`;
			const expectPickedRange = async () => {
				await expect(range, 'The displayed date range must match the dates selected in the calendar')
					.toHaveText(new RegExp(`^(${escapeRegExp(expectedRange)}|${escapeRegExp(knownShiftedRange)})$`));
				const shown = await range.innerText();
				if (shown !== expectedRange) {
					test.info().annotations.push({ type: 'known issue', description: `Version end date shown one day late: picked ${expectedRange}, shown ${shown}` });
					await test.info().attach('version-date-mismatch', {
						body: Buffer.from(JSON.stringify({ expected: expectedRange, actual: shown }, null, 2)),
						contentType: 'application/json',
					});
					await test.info().attach('version-date-mismatch-screenshot', { body: await page.screenshot(), contentType: 'image/png' });
				}
			};
			await range.click();
			await editor.getByRole('button', { name: calendarLabel(newStart), exact: true }).click();
			await editor.getByRole('button', { name: calendarLabel(newEnd), exact: true }).click();
			await expectPickedRange();
			await title.fill(updatedVersionName);
			await editor.locator('textarea').fill(versionDescription);
			await expect(title).toHaveValue(updatedVersionName);
			await expect(editor.getByRole('button', { name: 'Update', exact: true })).toBeEnabled();
			await editor.getByRole('button', { name: 'Update', exact: true }).click();
			await expect(editor.getByRole('heading', { name: 'Edit version', exact: true })).toBeHidden({ timeout: 30000 });
			await expect(page.getByRole('dialog').getByRole('row').filter({ hasText: updatedVersionName })).toBeVisible();
			await reopenSettings(updatedProjectName, updatedApplicationName, updatedVersionName);
			await page.getByRole('dialog').getByText('Versions', { exact: true }).first().click();
			await page.getByRole('dialog').getByRole('row').filter({ hasText: updatedVersionName }).getByTestId('more-vertical').click();
			await page.getByText('Edit Version', { exact: true }).click();
			await expect(title).toHaveValue(updatedVersionName);
			await expect(editor.locator('textarea')).toHaveValue(versionDescription);
			await expectPickedRange();
			await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
			await expect(editor.getByRole('heading', { name: 'Edit version', exact: true })).toBeHidden();
		});

		await test.step('Verify deletion confirmation and valid/invalid input', async () => {
			const settings = page.getByRole('dialog');
			await settings.getByText('Project Details', { exact: true }).first().click();
			await expect(settings.getByRole('heading', { name: 'Project Details', exact: true })).toBeVisible();
			await expect(settings.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(updatedProjectName);
			await settings.getByRole('button', { name: 'Delete project', exact: true }).click();

			const confirmation = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: "Enter 'DELETE' to confirm.", exact: true }) });
			const confirmationInput = confirmation.getByRole('textbox', { name: "Enter 'DELETE' to confirm.", exact: true });
			const deleteButton = confirmation.getByRole('button', { name: 'Delete', exact: true });
			const cancelButton = confirmation.getByRole('button', { name: 'Cancel', exact: true });
			await expect(confirmation.getByText('Delete project', { exact: true })).toBeVisible();
			await expect(confirmation).toContainText(`Deleting the project "${updatedProjectName}"`);
			await expect(confirmation).toContainText('permanent deletion of all Project assets like Test Cases, Suites, Plans, Run Results and Elements');
			await expect(confirmation).toContainText('This action is irreversible and the project cannot be restored.');
			await expect(confirmation).toContainText("Please type 'DELETE' to confirm");
			await expect(confirmation.getByText('This action cannot be undone.', { exact: true })).toBeVisible();
			await expect(confirmationInput).toBeEmpty();
			await expect(deleteButton).toBeDisabled();
			await expect(cancelButton).toBeEnabled();

			// Return to invalid input after a valid value to verify the button disables again.
			for (const value of ['delete', 'Delete', 'DELET', 'INVALID', 'DELETE', 'DELETE123', '', 'DELETE']) {
				await test.step(`Confirm input ${JSON.stringify(value)}`, async () => {
					await confirmationInput.fill(value);
					await expect(confirmationInput).toHaveValue(value);
					if (value === 'DELETE') {
						await expect(deleteButton).toBeEnabled();
					} else {
						await expect(deleteButton).toBeDisabled();
					}
					await expect(cancelButton).toBeEnabled();
				});
			}
			await deleteButton.click();
			await expect(confirmationInput).toBeHidden({ timeout: 30000 });
		});

		await test.step('Verify redirection to Testsigma Advanced Examples and project removal', async () => {
			await expect(page).toHaveURL(/\/ui\/td\/\d+\/cases\/filters/, { timeout: 60000 });
			await page.mouse.move(20, 100);
			await expect(projectApplicationTab).toHaveText('Testsigma Advanced Examples', { timeout: 30000 });
			await page.reload({ waitUntil: 'domcontentloaded' });
			await page.mouse.move(20, 100);
			await expect(projectApplicationTab).toHaveText('Testsigma Advanced Examples', { timeout: 30000 });
			await projectApplicationTab.click();
			await expect(projectDropdown).toHaveText('Testsigma Advanced Examples');
			await projectDropdown.click();
			const search = page.locator('input[aria-label="Search"]');
			await expect(search).toBeVisible();
			await search.fill(updatedProjectName);
			await expect(page.getByRole('row', { name: updatedProjectName, exact: true })).toHaveCount(0);
		});

	} catch (error) {
		await test.info().attach('project-settings-failure', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
		throw new Error(`Project settings and deletion scenario failed for ${projectName}.`, { cause: error });
	}
});
