/**
 * Steps shared by the Create Project specs: opening the project switcher, creating a web project (or switching to
 * it when an earlier run created it already) and selecting projects from the switcher.
 */
import { expect, type Page } from '@playwright/test';

// A web project to create, on the Classic or Modern engine.
export type NewProject = {
	name: string;
	engine: 'Classic' | 'Modern';
	application: string;
	version: string;
	description: string;
};

export type ProjectSwitcher = ReturnType<typeof projectSwitcherOf>;

function projectSwitcherOf(page: Page) {
	const dropdown = (label: string) => page.getByText(label, { exact: true }).locator('..').locator('[data-isopen]');
	return {
		// The header button showing the current project, which opens the switcher.
		projectApplicationTab: page.locator('[role="button"]').filter({ has: page.locator('[data-testid="web"]') }),
		projectDropdown: dropdown('Project'),
		applicationDropdown: dropdown('Application'),
		versionDropdown: dropdown('Version'),
		projectSettings: page.getByRole('button', { name: 'Project Settings' }),
		newProjectButton: page.getByRole('button', { name: 'New Project' }),
		goToProjectButton: page.getByRole('button', { name: 'Go to project' }),
		// The search box of the open Project dropdown.
		searchField: page.locator('input[aria-label="Search"]'),
	};
}

// Opens the project switcher from the side navigation, which only shows its labels while hovered, and checks it.
export async function openProjectSwitcher(page: Page) {
	const switcher = projectSwitcherOf(page);
	await page.mouse.move(20, 100);
	await expect(switcher.projectApplicationTab).toBeVisible();
	await switcher.projectApplicationTab.click();

	await expect(switcher.projectDropdown).toBeVisible();
	await expect(switcher.applicationDropdown).toBeVisible();
	await expect(switcher.versionDropdown).toBeVisible();
	await expect(switcher.projectSettings).toBeVisible();
	await expect(switcher.newProjectButton).toBeEnabled();
	await expect(switcher.goToProjectButton).toBeDisabled();
	return switcher;
}

// Creates the project from the open switcher, checking the New project form, or switches to it when it exists.
export async function createOrSwitchToProject(page: Page, switcher: ProjectSwitcher, project: NewProject) {
	const { projectDropdown, projectApplicationTab, goToProjectButton, newProjectButton, searchField } = switcher;
	let projectAlreadyExists = (await projectDropdown.innerText()).trim() === project.name;
	if (!projectAlreadyExists) {
		await projectDropdown.click();
		await expect(searchField).toBeVisible();
		await searchField.fill(project.name);

		const existingProjectRow = page.getByRole('row', { name: project.name, exact: true });
		projectAlreadyExists = await existingProjectRow.count() > 0;
		if (projectAlreadyExists) {
			await existingProjectRow.first().click();
		}
	}

	if (projectAlreadyExists) {
		// The header shows the current project; switch to it only when another project is current.
		if ((await projectApplicationTab.innerText()).trim() !== project.name) {
			await expect(goToProjectButton).toBeEnabled();
			await goToProjectButton.click();
			await expect(page).toHaveURL(/cases\/filters/, { timeout: 30000 });
		}
		return;
	}

	// Close the Project dropdown before opening the New project form.
	await projectDropdown.click();
	await expect(searchField).toBeHidden();
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
	await expect(page.getByText(/^Engine version\*?$/)).toBeVisible();
	await expect(cancelButton).toBeEnabled();
	await expect(createButton).toBeDisabled();

	const multipleApplications = page.getByRole('checkbox', { name: 'Allow adding multiple applications in this project' });
	const multipleVersions = page.getByRole('checkbox', { name: 'Allow multiple versions for applications' });
	await multipleApplications.check();
	await expect(multipleApplications).toBeChecked();
	await expect(page.getByText(/add application/i)).toBeVisible();
	await multipleVersions.check();
	await expect(multipleVersions).toBeChecked();

	await projectNameField.fill(project.name);
	await descriptionField.fill(project.description);
	await applicationNameField.fill(project.application);
	await applicationVersionField.fill(project.version);

	const engine = page.getByRole('button').filter({ has: page.getByText(project.engine, { exact: true }) });
	await expect(engine).toBeVisible();
	await engine.click();
	await expect(engine).toHaveClass(/border-primary-1000/);

	await expect(projectNameField).toHaveValue(project.name);
	await expect(applicationNameField).toHaveValue(project.application);
	await expect(applicationVersionField).toHaveValue(project.version);
	await expect(cancelButton).toBeEnabled();
	await expect(createButton).toBeEnabled();
	await createButton.click();

	await expect(page.getByText(/project.*created|created.*successfully/i)).toBeVisible({ timeout: 30000 });
	await expect(page).toHaveURL(/cases\/filters/, { timeout: 60000 });
}

// The side navigation and its switcher, opened afresh after reloading the page.
async function reopenProjectSwitcher(page: Page, switcher: ProjectSwitcher) {
	await page.reload();
	await page.mouse.move(20, 100);
	await expect(switcher.projectApplicationTab).toBeVisible({ timeout: 30000 });
	await switcher.projectApplicationTab.click();
}

/**
 * Checks selecting projects in the switcher once the project is current: choosing another project enables
 * "Go to project", and choosing the project again shows its application and version and leaves "Go to project"
 * disabled, since it is already current. With reloadBetween, the switcher is opened afresh before choosing the
 * project again.
 */
export async function checkSelectingProjects(page: Page, switcher: ProjectSwitcher, project: NewProject, { reloadBetween }: { reloadBetween: boolean }) {
	const { projectDropdown, applicationDropdown, versionDropdown, goToProjectButton, searchField } = switcher;
	await reopenProjectSwitcher(page, switcher);
	await expect(projectDropdown).toContainText(project.name);
	await projectDropdown.click();

	await expect(searchField).toBeVisible();
	await searchField.fill('');
	const otherProjectRow = page.getByRole('row').filter({ hasNotText: project.name }).first();
	await expect(otherProjectRow).toBeVisible();
	await otherProjectRow.click();
	// Choosing a project other than the current one enables navigating to it.
	await expect(goToProjectButton).toBeEnabled();

	if (reloadBetween) {
		await reopenProjectSwitcher(page, switcher);
	}
	await projectDropdown.click();
	await searchField.fill(project.name);
	const createdProjectRow = page.getByRole('row', { name: project.name, exact: true });
	await expect(createdProjectRow).toBeVisible();
	await createdProjectRow.click();
	await expect(projectDropdown).toContainText(project.name);
	await expect(applicationDropdown).toContainText(project.application);
	await expect(versionDropdown).toContainText(project.version);
	// The project is already the current one, so there is nothing to navigate to.
	await expect(goToProjectButton).toBeDisabled();
}
