/**
 * The project switcher, opened from the header button of the side navigation showing the current project. It picks
 * the project, application and version to work on, and opens Project Settings and the New project form.
 */
import { expect, type Page } from '@playwright/test';
import { NewProjectForm, type NewProject } from './NewProjectForm';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';

export class ProjectSwitcher {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	// The header button showing the current project, which opens the switcher.
	get headerButton() {
		return this.page.locator('[role="button"]').filter({ has: this.page.locator('[data-testid="web"]') });
	}

	private dropdown(label: string) {
		return this.page.getByText(label, { exact: true }).locator('..').locator('[data-isopen]');
	}

	get projectDropdown() {
		return this.dropdown('Project');
	}

	get applicationDropdown() {
		return this.dropdown('Application');
	}

	get versionDropdown() {
		return this.dropdown('Version');
	}

	get settingsButton() {
		return this.page.getByRole('button', { name: 'Project Settings' });
	}

	get newProjectButton() {
		return this.page.getByRole('button', { name: 'New Project' });
	}

	get goToProjectButton() {
		return this.page.getByRole('button', { name: 'Go to project' });
	}

	// The search box of the open Project dropdown.
	get searchField() {
		return this.page.locator('input[aria-label="Search"]');
	}

	// A project's own row in the open Project dropdown. When the search leaves one project, the list's wrapping row
	// has the same name as it, so the row wanted is the one holding no other rows.
	projectRow(name: string) {
		return this.page.getByRole('row', { name, exact: true }).filter({ hasNot: this.page.getByRole('row') });
	}

	// Opens the switcher from the side navigation, which only shows its labels while hovered.
	async open() {
		await this.page.mouse.move(20, 100);
		await expect(this.headerButton).toBeVisible();
		await this.headerButton.click();
	}

	// Opens the switcher and checks its dropdowns and buttons.
	async openAndCheck() {
		await this.open();
		await expect(this.projectDropdown).toBeVisible();
		await expect(this.applicationDropdown).toBeVisible();
		await expect(this.versionDropdown).toBeVisible();
		await expect(this.settingsButton).toBeVisible();
		await expect(this.newProjectButton).toBeEnabled();
		await expect(this.goToProjectButton).toBeDisabled();
	}

	// The side navigation and its switcher, opened afresh after reloading the page.
	async reopen() {
		await this.page.reload();
		await this.page.mouse.move(20, 100);
		await expect(this.headerButton).toBeVisible({ timeout: 30000 });
		await this.headerButton.click();
	}

	async openNewProjectForm() {
		await this.newProjectButton.click();
		return new NewProjectForm(this.page);
	}

	// Creates the project from the open switcher, checking the New project form, or switches to it when it exists.
	async createOrSwitchTo(project: NewProject) {
		let projectAlreadyExists = (await this.projectDropdown.innerText()).trim() === project.name;
		if (!projectAlreadyExists) {
			await this.projectDropdown.click();
			await expect(this.searchField).toBeVisible();
			await this.searchField.fill(project.name);

			const existingProjectRow = this.projectRow(project.name);
			projectAlreadyExists = await existingProjectRow.count() > 0;
			if (projectAlreadyExists) {
				await existingProjectRow.click();
			}
		}

		if (projectAlreadyExists) {
			// The header shows the current project; switch to it only when another project is current.
			if ((await this.headerButton.innerText()).trim() !== project.name) {
				await expect(this.goToProjectButton).toBeEnabled();
				await this.goToProjectButton.click();
				await expect(this.page).toHaveURL(/cases\/filters/, { timeout: 30000 });
			}
			return;
		}

		// Close the Project dropdown before opening the New project form.
		await this.projectDropdown.click();
		await expect(this.searchField).toBeHidden();
		const form = await this.openNewProjectForm();
		await form.expectBlank();
		await form.fill(project);
		await form.create();
	}

	/**
	 * Checks selecting projects in the switcher once the project is current: choosing another project enables
	 * "Go to project", and choosing the project again shows its application and version and leaves "Go to project"
	 * disabled, since it is already current. With reloadBetween, the switcher is opened afresh before choosing the
	 * project again.
	 */
	async checkSelectingProjects(project: NewProject, { reloadBetween }: { reloadBetween: boolean }) {
		await this.reopen();
		await expect(this.projectDropdown).toContainText(project.name);
		await this.projectDropdown.click();

		await expect(this.searchField).toBeVisible();
		await this.searchField.fill('');
		const otherProjectRow = this.page.getByRole('row').filter({ hasNotText: project.name }).first();
		await expect(otherProjectRow).toBeVisible();
		await otherProjectRow.click();
		// Choosing a project other than the current one enables navigating to it.
		await expect(this.goToProjectButton).toBeEnabled();

		if (reloadBetween) {
			await this.reopen();
		}
		await this.projectDropdown.click();
		await this.searchField.fill(project.name);
		const createdProjectRow = this.projectRow(project.name);
		await expect(createdProjectRow).toBeVisible();
		await createdProjectRow.click();
		await expect(this.projectDropdown).toContainText(project.name);
		await expect(this.applicationDropdown).toContainText(project.application);
		await expect(this.versionDropdown).toContainText(project.version);
		// The project is already the current one, so there is nothing to navigate to.
		await expect(this.goToProjectButton).toBeDisabled();
	}

	/**
	 * Reloads the page and opens Project Settings from the switcher, first checking the switcher shows the project,
	 * application and version expected to be current.
	 */
	async reopenSettings(project: string, application: string, version: string) {
		await this.page.reload({ waitUntil: 'domcontentloaded' });
		await this.page.mouse.move(20, 100);
		await expect(this.headerButton).toHaveText(project, { timeout: 30000 });
		await this.headerButton.click();
		await expect(this.projectDropdown).toHaveText(project);
		await expect(this.applicationDropdown).toHaveText(application);
		await expect(this.versionDropdown).toHaveText(version);
		await this.settingsButton.click();
		const settings = new ProjectSettingsDialog(this.page);
		await expect(settings.heading('Project Details')).toBeVisible();
		return settings;
	}
}
