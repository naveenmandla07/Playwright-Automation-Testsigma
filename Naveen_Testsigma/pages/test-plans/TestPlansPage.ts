/**
 * Test Plans: the list of a version's plans and the plan details page shown once a plan is created.
 */
import { expect, type Page } from '@playwright/test';
import { BasePage } from '../BasePage';
import { SideNavigation } from '../components/SideNavigation';
import { CreateTestPlanWizard } from './CreateTestPlanWizard';

// The list of the version's plans.
export class TestPlansPage extends BasePage {
	readonly versionId: number;
	readonly plansTab = this.main.getByRole('link', { name: 'Test Plans', exact: true });
	readonly schedulesTab = this.main.getByRole('link', { name: 'Schedules', exact: true });
	readonly refreshButton = this.main.getByRole('button', { name: 'Refresh' });
	readonly createButton = this.main.getByRole('button', { name: 'Create Test Plan' }).first();
	readonly search = this.main.getByRole('textbox', { name: 'Search' });

	constructor(page: Page, versionId: number) {
		super(page);
		this.versionId = versionId;
	}

	async openFromNavigation() {
		await new SideNavigation(this.page).hover(300);
		await this.page.getByRole('link', { name: 'Test Plans', exact: true }).click();
		await expect(this.page).toHaveURL(new RegExp(`/td/${this.versionId}/plans$`), { timeout: 30000 });
	}

	text(text: string) {
		return this.main.getByText(text, { exact: true });
	}

	// A plan's row, named after the plan and its type, e.g. "My plan - Cross Browser".
	planRow(name: string) {
		return this.main.getByRole('grid').getByRole('row', { name: `${name} - Cross Browser` }).last();
	}

	planLink(name: string) {
		return this.main.getByRole('link', { name, exact: true });
	}

	// Opens the Create Test Plan wizard once it is ready to type into.
	async startCreating() {
		const wizard = new CreateTestPlanWizard(this.page, this.versionId);
		// The wizard loads the existing labels after it appears and re-renders its fields when they arrive, dropping
		// anything typed before then, so wait for them before typing.
		const labelsLoaded = this.page.waitForResponse((response) => new URL(response.url()).pathname === '/test_plan_tags' && response.ok(), { timeout: 45000 });
		// The address changes before the wizard replaces the list, so wait for the wizard itself and click again if it
		// has not opened.
		await expect(async () => {
			if (!(await wizard.continueButton.isVisible())) {
				await this.createButton.click({ timeout: 5000 });
			}
			await expect(wizard.continueButton).toBeVisible({ timeout: 10000 });
		}).toPass({ timeout: 45000 });
		await labelsLoaded;
		await expect(this.page).toHaveURL(new RegExp(`/td/${this.versionId}/plans/new$`));
		return wizard;
	}
}

// The details page of a saved plan.
export class TestPlanDetailsPage extends BasePage {
	readonly planId: number;
	readonly viewReports = this.main.getByRole('link', { name: 'View Reports' });

	constructor(page: Page, planId: number) {
		super(page);
		this.planId = planId;
	}

	async expectOpen(name: string) {
		await expect(this.page).toHaveURL(new RegExp(`/plans/${this.planId}/details$`), { timeout: 30000 });
		await expect(this.main.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 30000 });
	}

	button(name: 'Edit' | 'Delete') {
		return this.main.getByRole('button', { name, exact: true });
	}

	// A linked machine's row; its name ends the cell's text.
	machineRow(name: string) {
		return this.main.getByRole('grid').getByRole('gridcell', { name: new RegExp(`${name}$`) }).first();
	}
}
