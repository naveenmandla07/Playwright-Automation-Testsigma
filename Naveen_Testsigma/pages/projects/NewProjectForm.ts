/**
 * The New project form, opened from the project switcher.
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

export class NewProjectForm {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	get heading() {
		return this.page.getByText('New project', { exact: true });
	}

	get nameField() {
		return this.page.getByRole('textbox', { name: 'Project name' });
	}

	get descriptionField() {
		return this.page.locator('textarea');
	}

	get applicationNameField() {
		return this.page.getByRole('textbox', { name: 'Web application' });
	}

	get applicationVersionField() {
		return this.page.getByRole('textbox', { name: 'Production' });
	}

	get multipleApplications() {
		return this.page.getByRole('checkbox', { name: 'Allow adding multiple applications in this project' });
	}

	get multipleVersions() {
		return this.page.getByRole('checkbox', { name: 'Allow multiple versions for applications' });
	}

	get cancelButton() {
		return this.page.getByRole('button', { name: 'Cancel', exact: true });
	}

	get createButton() {
		return this.page.getByRole('button', { name: 'Create', exact: true });
	}

	engine(name: NewProject['engine']) {
		return this.page.getByRole('button').filter({ has: this.page.getByText(name, { exact: true }) });
	}

	// The form as it opens: a web application, and Create disabled until it is filled in.
	async expectBlank() {
		await expect(this.heading).toBeVisible();
		await expect(this.nameField).toBeVisible();
		await expect(this.descriptionField).toBeVisible();
		await expect(this.page.getByText('Application type*', { exact: true })).toBeVisible();
		await expect(this.page.getByText('Web application', { exact: true }).first()).toBeVisible();
		await expect(this.page.getByText(/^Engine version\*?$/)).toBeVisible();
		await expect(this.cancelButton).toBeEnabled();
		await expect(this.createButton).toBeDisabled();
	}

	// Allows several applications and versions, fills in the project and picks its engine, checking each was taken.
	async fill(project: NewProject) {
		await this.multipleApplications.check();
		await expect(this.multipleApplications).toBeChecked();
		await expect(this.page.getByText(/add application/i)).toBeVisible();
		await this.multipleVersions.check();
		await expect(this.multipleVersions).toBeChecked();

		await this.nameField.fill(project.name);
		await this.descriptionField.fill(project.description);
		await this.applicationNameField.fill(project.application);
		await this.applicationVersionField.fill(project.version);

		const engine = this.engine(project.engine);
		await expect(engine).toBeVisible();
		await engine.click();
		await expect(engine).toHaveClass(/border-primary-1000/);

		await expect(this.nameField).toHaveValue(project.name);
		await expect(this.applicationNameField).toHaveValue(project.application);
		await expect(this.applicationVersionField).toHaveValue(project.version);
		await expect(this.cancelButton).toBeEnabled();
		await expect(this.createButton).toBeEnabled();
	}

	// Creates the project, which then opens on its test cases.
	async create() {
		await this.createButton.click();
		await expect(this.page.getByText(/project.*created|created.*successfully/i)).toBeVisible({ timeout: 30000 });
		await expect(this.page).toHaveURL(/cases\/filters/, { timeout: 60000 });
	}
}
