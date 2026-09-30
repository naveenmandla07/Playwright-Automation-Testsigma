/**
 * Every editable Project Settings field on a Modern project, then deleting the project.
 *
 * Scenario (one test, reported step by step):
 * - Create or switch to "Testsigma_Settings_Delete_Modern".
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
 * Known issue: the version date range can show one day later than the dates picked; this is a soft check that
 * attaches the mismatch. Runs in the serial chromium-projects project because it changes the account's current
 * project.
 */
import { expect, test } from '@playwright/test';
import { accountEmail, missingCredentials, missingCredentialsMessage, signInToTestsigma } from '../support/testsigma-auth';

const projectName = 'Testsigma_Settings_Delete_Modern';

test('[Modern] Verify all editable project settings, persistence and deletion', async ({ page }) => {
	test.setTimeout(360000);
	page.setDefaultTimeout(15000);
	test.skip(missingCredentials, missingCredentialsMessage);

	try {
		await signInToTestsigma(page);

		await page.mouse.move(20, 100);
		const projectApplicationTab = page.locator('[role="button"]').filter({ has: page.locator('[data-testid="web"]') });
		await expect(projectApplicationTab).toBeVisible();
		await projectApplicationTab.click();

		const projectDropdown = page.getByText('Project', { exact: true }).locator('..').locator('[data-isopen]');
		const applicationDropdown = page.getByText('Application', { exact: true }).locator('..').locator('[data-isopen]');
		const versionDropdown = page.getByText('Version', { exact: true }).locator('..').locator('[data-isopen]');
		const projectSettings = page.getByRole('button', { name: 'Project Settings' });
		const newProjectButton = page.getByRole('button', { name: 'New Project' });
		const goToProjectButton = page.getByRole('button', { name: 'Go to project' });

		await expect(projectDropdown).toBeVisible();
		await expect(applicationDropdown).toBeVisible();
		await expect(versionDropdown).toBeVisible();
		await expect(projectSettings).toBeVisible();
		await expect(newProjectButton).toBeEnabled();
		await expect(goToProjectButton).toBeDisabled();

		let projectAlreadyExists = (await projectDropdown.innerText()).trim() === projectName;
		if (!projectAlreadyExists) {
			await projectDropdown.click();
			const searchField = page.locator('input[aria-label="Search"]');
			await expect(searchField).toBeVisible();
			await searchField.fill(projectName);

			const existingProjectRow = page.getByRole('row', { name: projectName, exact: true });
			projectAlreadyExists = await existingProjectRow.count() > 0;
			if (projectAlreadyExists) {
				await existingProjectRow.click();
			}
		}

		if (projectAlreadyExists) {
			// The header shows the current project; switch to it only when another project is current.
			if ((await projectApplicationTab.innerText()).trim() !== projectName) {
				await expect(goToProjectButton).toBeEnabled();
				await goToProjectButton.click();
				await expect(page).toHaveURL(/cases\/filters/, { timeout: 30000 });
			}
		} else {
			await projectDropdown.click();
			await expect(page.locator('input[aria-label="Search"]')).toBeHidden();
			await newProjectButton.click();

			const projectNameField = page.getByRole('textbox', { name: 'Project name' });
			const descriptionField = page.locator('textarea');
			const applicationNameField = page.getByRole('textbox', { name: 'Web application' });
			const applicationVersionField = page.getByRole('textbox', { name: 'Production' });
			const cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
			const createButton = page.getByRole('button', { name: 'Create', exact: true });

			await expect(page.getByText('New project', { exact: true })).toBeVisible();
			await expect(projectNameField).toBeVisible();
			await expect(descriptionField).toBeVisible();
			await expect(page.getByText('Application type*', { exact: true })).toBeVisible();
			await expect(page.getByText('Web application', { exact: true }).first()).toBeVisible();
			await expect(page.getByText('Engine version*', { exact: true })).toBeVisible();
			await expect(cancelButton).toBeEnabled();
			await expect(createButton).toBeDisabled();

			const multipleApplications = page.getByRole('checkbox', { name: 'Allow adding multiple applications in this project' });
			const multipleVersions = page.getByRole('checkbox', { name: 'Allow multiple versions for applications' });
			await multipleApplications.check();
			await expect(multipleApplications).toBeChecked();
			await expect(page.getByText(/add application/i)).toBeVisible();
			await multipleVersions.check();
			await expect(multipleVersions).toBeChecked();

			await projectNameField.fill(projectName);
			await descriptionField.fill('Project created by the Testsigma Playwright automation suite using the Modern engine.');
			await applicationNameField.fill('Web App');
			await applicationVersionField.fill('modern web');

			const modernEngine = page.getByRole('button').filter({ has: page.getByText('Modern', { exact: true }) });
			await expect(modernEngine).toBeVisible();
			await modernEngine.click();
			await expect(modernEngine).toHaveClass(/border-primary-1000/);

			await expect(projectNameField).toHaveValue(projectName);
			await expect(applicationNameField).toHaveValue('Web App');
			await expect(applicationVersionField).toHaveValue('modern web');
			await expect(cancelButton).toBeEnabled();
			await expect(createButton).toBeEnabled();
			await createButton.click();

			await expect(page.getByText(/project.*created|created.*successfully/i)).toBeVisible({ timeout: 30000 });
			await expect(page).toHaveURL(/cases\/filters/, { timeout: 60000 });
		}

		await page.reload();
		await page.mouse.move(20, 100);
		await expect(projectApplicationTab).toBeVisible({ timeout: 30000 });
		await projectApplicationTab.click();
		await expect(projectDropdown).toContainText(projectName);
		await projectDropdown.click();

		const searchField = page.locator('input[aria-label="Search"]');
		await expect(searchField).toBeVisible();
		await searchField.fill('');
		const otherProjectRow = page.getByRole('row').filter({ hasNotText: projectName }).first();
		await expect(otherProjectRow).toBeVisible();
		await otherProjectRow.click();
		await expect(goToProjectButton).toBeEnabled();

		await projectDropdown.click();
		await searchField.fill(projectName);
		const createdProjectRow = page.getByRole('row', { name: projectName, exact: true });
		await expect(createdProjectRow).toBeVisible();
		await createdProjectRow.click();
		await expect(projectDropdown).toContainText(projectName);
		await expect(applicationDropdown).toContainText('Web App');
		await expect(versionDropdown).toContainText('modern web');
		await expect(goToProjectButton).toBeDisabled();
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

		const updatedProjectName = `${projectName}_Updated`;
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
			await range.click();
			await editor.getByRole('button', { name: calendarLabel(newStart), exact: true }).click();
			await editor.getByRole('button', { name: calendarLabel(newEnd), exact: true }).click();
			await expect.soft(range, 'The displayed date range must match the dates selected in the calendar').toHaveText(expectedRange);
			if ((await range.innerText()) !== expectedRange) {
				await test.info().attach('version-date-mismatch', {
					body: Buffer.from(JSON.stringify({ expected: expectedRange, actual: await range.innerText() }, null, 2)),
					contentType: 'application/json',
				});
				await test.info().attach('version-date-mismatch-screenshot', { body: await page.screenshot(), contentType: 'image/png' });
			}
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
			await expect.soft(range, 'The displayed date range must match the dates selected in the calendar').toHaveText(expectedRange);
			if ((await range.innerText()) !== expectedRange) {
				await test.info().attach('version-date-mismatch', {
					body: Buffer.from(JSON.stringify({ expected: expectedRange, actual: await range.innerText() }, null, 2)),
					contentType: 'application/json',
				});
				await test.info().attach('version-date-mismatch-screenshot', { body: await page.screenshot(), contentType: 'image/png' });
			}
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
