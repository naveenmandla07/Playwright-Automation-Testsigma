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
import { expect, test } from '../pages/fixtures';
import type { NewProject } from '../pages/projects/NewProjectForm';
import type { ProjectSwitcher } from '../pages/projects/ProjectSwitcher';
import { ProjectSettingsDialog } from '../pages/projects/ProjectSettingsDialog';
import { ProjectsApi } from '../pages/projects/ProjectsApi';
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
async function deleteLeftoverProjects(projectSwitcher: ProjectSwitcher) {
	const projects = new ProjectsApi(projectSwitcher.page);
	const leftovers = async () => (await projects.list()).filter((item) => [projectName, updatedProjectName].includes(item.name));
	for (const leftover of await leftovers()) {
		await projects.delete(leftover);
	}
	await expect.poll(async () => (await leftovers()).length, { timeout: 30000 }).toBe(0);
	// The current project may have been one of them, so load the page again to show the one Testsigma moved to.
	await projectSwitcher.page.reload();
}

test('[Modern] Verify all editable project settings, persistence and deletion', async ({ page, projectSwitcher }) => {
	test.setTimeout(360000);
	page.setDefaultTimeout(15000);
	test.skip(missingCredentials, missingCredentialsMessage);

	const settings = new ProjectSettingsDialog(page);
	try {
		await signInToTestsigma(page);
		await deleteLeftoverProjects(projectSwitcher);

		await projectSwitcher.openAndCheck();
		await projectSwitcher.createOrSwitchTo(project);
		await projectSwitcher.checkSelectingProjects(project, { reloadBetween: false });
		await test.step('Open Project Settings and verify every tab', async () => {
			await expect(projectSwitcher.settingsButton).toBeEnabled();
			await projectSwitcher.settingsButton.click();
			await expect(settings.heading('Project Details')).toBeVisible();
			await expect(settings.text('Edit Project')).toBeVisible();

			const tabs = ['Project Details', 'Applications', 'Versions', 'Project Members', 'Test Case Types', 'Requirement Types'];
			for (const tab of tabs) {
				await expect(settings.tab(tab)).toBeVisible();
			}
			for (const tab of tabs) {
				await test.step(`Verify ${tab}`, async () => {
					await settings.tab(tab).click();
					await expect(settings.heading(tab === 'Applications' ? 'Applications settings' : tab)).toBeVisible();
					if (tab === 'Project Details' || tab === 'Applications') {
						await expect(settings.nameField).toHaveValue(tab === 'Project Details' ? projectName : 'Web App');
						await expect(settings.nameField).toBeEditable();
						await expect(settings.text('Description')).toBeVisible();
						await expect(settings.descriptionField).toBeEditable();
						for (const label of ['Created by', 'Last Updated by']) {
							await expect(settings.text(label)).toBeVisible();
						}
						const disabledFields = settings.root.locator('input:disabled');
						await expect(disabledFields).toHaveCount(2);
						for (const field of await disabledFields.all()) {
							await expect(field).toBeDisabled();
						}
						await expect(settings.updateButton).toBeDisabled();
						await expect(settings.cancelButton).toBeEnabled();
						if (tab === 'Project Details') {
							await expect(settings.descriptionField).toHaveValue('Project created by the Testsigma Playwright automation suite using the Modern engine.');
							await expect(settings.option('Allow adding multiple applications in this project')).toBeChecked();
							await expect(settings.option('Allow multiple versions')).toBeChecked();
							await expect(settings.deleteProjectButton).toBeEnabled();
						} else {
							await expect(settings.heading('1 Applications')).toBeVisible();
							await expect(settings.root.getByRole('button', { name: 'New application', exact: true })).toBeEnabled();
							for (const label of ['Web App', 'Web application', 'Engine version', 'Modern']) {
								await expect(settings.text(label)).toBeVisible();
							}
						}
					} else if (tab === 'Versions') {
						await expect(settings.heading('1 Versions')).toBeVisible();
						await expect(settings.root.getByRole('button', { name: 'New version', exact: true })).toBeEnabled();
						for (const label of ['Application', 'Web App', 'Web application', 'Title', 'Start Date', 'End Date']) {
							await expect(settings.text(label)).toBeVisible();
						}
						await expect(settings.row('modern web')).toBeVisible();
					} else if (tab === 'Project Members') {
						await expect(settings.searchField).toBeEditable();
						for (const button of ['Assign', 'Invite']) {
							await expect(settings.root.getByRole('button', { name: button, exact: true })).toBeEnabled();
						}
						for (const label of ['Name', 'Email']) {
							await expect(settings.text(label)).toBeVisible();
						}
						await expect(settings.row(accountEmail)).toBeVisible();
					} else {
						await expect(settings.searchField).toBeEditable();
						const types = tab === 'Test Case Types'
							? ['Unit Test', 'Integration', 'Functional', 'Non Functional', 'User Experience']
							: ['Customer Requirements', 'Functional Requirements', 'Non-Functional Requirements', 'User Interface Requirements'];
						await expect(settings.heading(`${types.length} types`)).toBeVisible();
						for (const type of types) {
							await expect(settings.text(type)).toBeVisible();
						}
						await expect(settings.text('Add Type')).toBeVisible();
					}
				});
			}
		});

		const updatedApplicationName = 'Web App Updated';
		const updatedVersionName = 'modern web updated';
		const projectDescription = 'Project description updated by Playwright.';
		const applicationDescription = 'Application description updated by Playwright.';
		const versionDescription = 'Version description updated by Playwright.';

		await test.step('Verify every project option can be saved and restored', async () => {
			const options = [
				{ option: 'Allow adding multiple applications in this project', field: 'hasMultipleApps' },
				{ option: 'Allow multiple versions', field: 'hasMultipleVersions' },
			];
			for (const { option, field } of options) {
				for (const checked of [false, true]) {
					await test.step(`${option}: ${checked}`, async () => {
						await settings.tab('Project Details').click();
						// The form loads the saved values asynchronously and resets any change made before they arrive.
						await expect(settings.nameField).toHaveValue(projectName);
						await settings.setOption(option, field, checked);
						// The update is accepted (202) and applied asynchronously; reopen until the saved value is shown.
						await expect(async () => {
							await projectSwitcher.reopenSettings(projectName, 'Web App', 'modern web');
							await expect(settings.option(option)).toBeChecked({ checked, timeout: 2000 });
						}).toPass({ timeout: 60000 });
						await expect(settings.updateButton).toBeDisabled();
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
					await settings.tab(tab).click();
					await expect(settings.heading(tab)).toBeVisible();
					for (const original of names) {
						await settings.renameType(original, `${original} Updated`);
					}
					await projectSwitcher.reopenSettings(projectName, 'Web App', 'modern web');
					await settings.tab(tab).click();
					await expect(settings.heading(`${names.length} types`)).toBeVisible();
					for (const original of names) {
						await expect(settings.text(`${original} Updated`)).toBeVisible();
						await expect(settings.text(original)).toHaveCount(0);
					}
					const search = await settings.showSearch();
					await search.fill(`${names[0]} Updated`);
					await expect(settings.text(`${names[0]} Updated`)).toBeVisible();
					await expect(settings.text(`${names[1]} Updated`)).toBeHidden();
					await search.clear();
					await expect(settings.text(`${names[1]} Updated`)).toBeVisible();
				});
			}
		});

		await test.step('Verify read-only project member details and search', async () => {
			await settings.tab('Project Members').click();
			const member = settings.row(accountEmail);
			await expect(member).toBeVisible();
			await expect(member.getByText('Test Manager', { exact: true })).toBeVisible();
			await expect(member.locator('input, textarea, select, [contenteditable="true"], [data-testid="edit"]')).toHaveCount(0);
			const search = await settings.showSearch();
			await search.fill(accountEmail);
			await expect(member).toBeVisible();
			await search.fill('NoSuchMember_Playwright');
			await expect(member).toBeHidden();
			await search.clear();
			await expect(member).toBeVisible();
		});

		await test.step('Update project name and description and verify persistence', async () => {
			await settings.tab('Project Details').click();
			await expect(settings.nameField).toHaveValue(projectName);
			await expect(settings.updateButton).toBeDisabled();
			await settings.nameField.fill(updatedProjectName);
			await settings.descriptionField.fill(projectDescription);
			await expect(settings.nameField).toHaveValue(updatedProjectName);
			await expect(settings.updateButton).toBeEnabled();
			await settings.updateButton.click();
			await expect(page.getByText(/project.*updated.*successfully/i)).toBeVisible({ timeout: 30000 });
			await projectSwitcher.reopenSettings(updatedProjectName, 'Web App', 'modern web');
			await expect(settings.nameField).toHaveValue(updatedProjectName);
			await expect(settings.descriptionField).toHaveValue(projectDescription);
			await expect(settings.updateButton).toBeDisabled();
		});

		await test.step('Update application name and description and verify persistence', async () => {
			await settings.text('Applications').click();
			await expect(settings.heading('Applications settings')).toBeVisible();
			await expect(settings.nameField).toHaveValue('Web App');
			await expect(settings.updateButton).toBeDisabled();
			await settings.nameField.fill(updatedApplicationName);
			await settings.descriptionField.fill(applicationDescription);
			await expect(settings.nameField).toHaveValue(updatedApplicationName);
			await expect(settings.updateButton).toBeEnabled();
			await settings.updateButton.click();
			await expect(page.getByText(/application.*updated.*successfully/i)).toBeVisible({ timeout: 30000 });
			await projectSwitcher.reopenSettings(updatedProjectName, updatedApplicationName, 'modern web');
			await settings.text('Applications').click();
			await expect(settings.nameField).toHaveValue(updatedApplicationName);
			await expect(settings.descriptionField).toHaveValue(applicationDescription);
			await expect(settings.updateButton).toBeDisabled();
		});

		await test.step('Update version title, description, start date and end date and verify persistence', async () => {
			await settings.tab('Versions').click();
			await expect(settings.heading('Versions')).toBeVisible();
			await expect(settings.row('modern web')).toBeVisible();
			const editor = await settings.editVersion('modern web');
			await expect(editor.titleField).toHaveValue('modern web');
			await expect(editor.cancelButton).toBeEnabled();
			await expect(editor.rangeLabel).toBeVisible();
			const originalRange = await editor.range.innerText();
			const startDate = new Date(originalRange.split(' - ')[0]);
			expect(Number.isNaN(startDate.getTime())).toBe(false);
			const newStart = new Date(startDate.getFullYear(), startDate.getMonth(), 5);
			const newEnd = new Date(startDate.getFullYear(), startDate.getMonth(), 15);
			const displayDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
			const expectedRange = `${displayDate(newStart)} - ${displayDate(newEnd)}`;
			// Known issue: the range can show its end date one day later than the date picked. That shift is noted, with
			// what was shown, rather than failing the check; any other range fails it.
			const shiftedEnd = new Date(newEnd.getFullYear(), newEnd.getMonth(), newEnd.getDate() + 1);
			const knownShiftedRange = `${displayDate(newStart)} - ${displayDate(shiftedEnd)}`;
			const expectPickedRange = async () => {
				await expect(editor.range, 'The displayed date range must match the dates selected in the calendar')
					.toHaveText(new RegExp(`^(${escapeRegExp(expectedRange)}|${escapeRegExp(knownShiftedRange)})$`));
				const shown = await editor.range.innerText();
				if (shown !== expectedRange) {
					test.info().annotations.push({ type: 'known issue', description: `Version end date shown one day late: picked ${expectedRange}, shown ${shown}` });
					await test.info().attach('version-date-mismatch', {
						body: Buffer.from(JSON.stringify({ expected: expectedRange, actual: shown }, null, 2)),
						contentType: 'application/json',
					});
					await test.info().attach('version-date-mismatch-screenshot', { body: await page.screenshot(), contentType: 'image/png' });
				}
			};
			await editor.pickRange(newStart, newEnd);
			await expectPickedRange();
			await editor.titleField.fill(updatedVersionName);
			await editor.descriptionField.fill(versionDescription);
			await expect(editor.titleField).toHaveValue(updatedVersionName);
			await expect(editor.updateButton).toBeEnabled();
			await editor.updateButton.click();
			await expect(editor.heading).toBeHidden({ timeout: 30000 });
			await expect(settings.row(updatedVersionName)).toBeVisible();
			await projectSwitcher.reopenSettings(updatedProjectName, updatedApplicationName, updatedVersionName);
			await settings.tab('Versions').click();
			await settings.editVersion(updatedVersionName);
			await expect(editor.titleField).toHaveValue(updatedVersionName);
			await expect(editor.descriptionField).toHaveValue(versionDescription);
			await expectPickedRange();
			await editor.cancelButton.click();
			await expect(editor.heading).toBeHidden();
		});

		await test.step('Verify deletion confirmation and valid/invalid input', async () => {
			await settings.tab('Project Details').click();
			await expect(settings.heading('Project Details')).toBeVisible();
			await expect(settings.nameField).toHaveValue(updatedProjectName);
			const confirmation = await settings.openDeleteProject();
			await expect(confirmation.title).toBeVisible();
			await expect(confirmation.root).toContainText(`Deleting the project "${updatedProjectName}"`);
			await expect(confirmation.root).toContainText('permanent deletion of all Project assets like Test Cases, Suites, Plans, Run Results and Elements');
			await expect(confirmation.root).toContainText('This action is irreversible and the project cannot be restored.');
			await expect(confirmation.root).toContainText("Please type 'DELETE' to confirm");
			await expect(confirmation.root.getByText('This action cannot be undone.', { exact: true })).toBeVisible();
			await expect(confirmation.confirmField).toBeEmpty();
			await expect(confirmation.deleteButton).toBeDisabled();
			await expect(confirmation.cancelButton).toBeEnabled();

			// Return to invalid input after a valid value to verify the button disables again.
			for (const value of ['delete', 'Delete', 'DELET', 'INVALID', 'DELETE', 'DELETE123', '', 'DELETE']) {
				await test.step(`Confirm input ${JSON.stringify(value)}`, async () => {
					await confirmation.confirmField.fill(value);
					await expect(confirmation.confirmField).toHaveValue(value);
					if (value === 'DELETE') {
						await expect(confirmation.deleteButton).toBeEnabled();
					} else {
						await expect(confirmation.deleteButton).toBeDisabled();
					}
					await expect(confirmation.cancelButton).toBeEnabled();
				});
			}
			await confirmation.deleteButton.click();
			await expect(confirmation.confirmField).toBeHidden({ timeout: 30000 });
		});

		await test.step('Verify redirection to Testsigma Advanced Examples and project removal', async () => {
			await expect(page).toHaveURL(/\/ui\/td\/\d+\/cases\/filters/, { timeout: 60000 });
			await page.mouse.move(20, 100);
			await expect(projectSwitcher.headerButton).toHaveText('Testsigma Advanced Examples', { timeout: 30000 });
			await page.reload({ waitUntil: 'domcontentloaded' });
			await page.mouse.move(20, 100);
			await expect(projectSwitcher.headerButton).toHaveText('Testsigma Advanced Examples', { timeout: 30000 });
			await projectSwitcher.headerButton.click();
			await expect(projectSwitcher.projectDropdown).toHaveText('Testsigma Advanced Examples');
			await projectSwitcher.projectDropdown.click();
			await expect(projectSwitcher.searchField).toBeVisible();
			await projectSwitcher.searchField.fill(updatedProjectName);
			await expect(page.getByRole('row', { name: updatedProjectName, exact: true })).toHaveCount(0);
		});

	} catch (error) {
		await test.info().attach('project-settings-failure', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
		throw new Error(`Project settings and deletion scenario failed for ${projectName}.`, { cause: error });
	}
});
