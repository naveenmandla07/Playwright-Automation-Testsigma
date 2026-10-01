/**
 * The Create Test Plan wizard and its three steps: Basic Details, Add Test Suites & Link Machine Profiles, and Test
 * Plan Settings. The wizard fills the page's main area; its pickers and drawers open over it.
 */
import { expect, type Page } from '@playwright/test';
import { BasePage } from '../BasePage';
import { dropdown, fieldLabel, turnOn } from '../components/FormControls';
import { AddTestSuitesPicker } from './AddTestSuitesPicker';
import { MachineProfilesDrawer } from './MachineProfilesDrawer';

const steps = ['Basic Details', 'Add Test Suites & Link Machine Profiles', 'Test Plan Settings'];

export class CreateTestPlanWizard extends BasePage {
	readonly versionId: number;
	readonly continueButton = this.main.getByRole('button', { name: 'Continue', exact: true });
	readonly cancelButton = this.main.getByRole('button', { name: 'Cancel', exact: true });
	readonly createButton = this.main.getByRole('button', { name: 'Create', exact: true });

	// Basic Details
	readonly nameField = this.main.getByRole('textbox', { name: 'Name', exact: true });
	readonly descriptionToggle = this.main.getByRole('checkbox', { name: 'Description', exact: true });
	readonly descriptionField = this.main.getByRole('textbox', { name: 'Description', exact: true });
	readonly labelsField = this.main.getByRole('textbox', { name: 'Labels', exact: true });
	readonly nameRequired = this.text('Name is required');
	readonly crossBrowserType = this.main.getByRole('radio', { name: /^Cross browser testing/ });
	readonly customType = this.main.getByRole('radio', { name: /^Custom test plan/ });

	// Add Test Suites & Link Machine Profiles
	readonly suiteSearch = this.main.getByRole('textbox', { name: 'Search suite' });
	readonly linkTestMachineButton = this.main.getByRole('button', { name: 'Link Test Machine' });

	// Test Plan Settings
	readonly sendNotification = this.main.getByRole('checkbox', { name: 'Send Notification', exact: true });
	readonly emailField = this.main.getByRole('textbox', { name: 'Add Email' });

	constructor(page: Page, versionId: number) {
		super(page);
		this.versionId = versionId;
	}

	text(text: string) {
		return this.main.getByText(text, { exact: true });
	}

	fieldLabel(label: string) {
		return fieldLabel(this.main, label);
	}

	dropdown(label: string) {
		return dropdown(this.main, label);
	}

	async turnOn(name: string) {
		await turnOn(this.main, name);
	}

	async expectSteps() {
		for (const [index, label] of steps.entries()) {
			await expect(this.text(label)).toBeVisible();
			await expect(this.text(String(index + 1)).first()).toBeVisible();
		}
	}

	// Basic Details

	// The popup Cancel opens, asking before the wizard is left.
	get leaveDialog() {
		return this.page.getByRole('dialog').filter({ has: this.page.getByRole('heading', { name: 'Leave test plan creation?' }) });
	}

	// Fills in the name and description, leaving any that already hold the right value alone.
	async enterNameAndDescription(name: string, description: string) {
		if ((await this.nameField.inputValue()) !== name) {
			await this.nameField.fill(name);
		}
		await expect(this.nameField).toHaveValue(name);

		await this.turnOn('Description');
		await expect(this.descriptionField).toBeEditable();
		if ((await this.descriptionField.inputValue()) !== description) {
			await this.descriptionField.clear();
			await this.descriptionField.pressSequentially(description);
			await this.descriptionField.blur();
		}
		await expect(this.descriptionField).toHaveValue(description);
	}

	// Turning the description on can clear the form's own copy of it a moment later while the box keeps showing the
	// text, so the plan would be saved without it. An edit made once the form has settled hands the form the full text
	// again.
	async commitDescription(description: string) {
		await this.descriptionField.click();
		await this.descriptionField.press('End');
		await this.descriptionField.press('Space');
		await this.descriptionField.press('Backspace');
		await this.descriptionField.blur();
		await expect(this.descriptionField).toHaveValue(description);
	}

	labelChip(label: string) {
		return this.text(label);
	}

	// Each label is added by typing it and pressing Enter, which turns it into a chip and clears the box.
	async addMissingLabels(labels: string[]) {
		for (const label of labels) {
			if (await this.labelChip(label).isVisible()) {
				continue;
			}
			await this.labelsField.fill(label);
			await this.labelsField.press('Enter');
			await expect(this.labelsField).toBeEmpty();
			await expect(this.labelChip(label)).toBeVisible();
		}
	}

	removeLabelButton(label: string) {
		return this.labelChip(label).locator('..').getByTestId(/^remove-button-/);
	}

	// Add Test Suites & Link Machine Profiles

	// The heading of the plan's suites, e.g. "Test Suites (2)".
	suitesHeading(count: number) {
		return this.text(`Test Suites (${count})`);
	}

	machinesHeading(count: number) {
		return this.text(`Test Machines (${count})`);
	}

	// Machine cards show how many suites they run, e.g. "2 Suites".
	machineSuiteCounts(count: number) {
		return this.main.getByText(new RegExp(`^${count} Suites?$`));
	}

	// Each suite row of the plan has a menu, behind its three-dot icon, to manage or remove the suite.
	suiteMenu(suite: string) {
		return this.text(suite).first()
			.locator('xpath=ancestor::div[.//*[@data-testid="more-vertical"]][1]')
			.getByTestId('more-vertical');
	}

	// The popup asking where a suite is removed from.
	get removeSuiteDialog() {
		return this.page.getByRole('dialog').filter({ hasText: 'Remove suite options' });
	}

	// Opens the picker and checks its counts. Suites already in the plan open in the selected list.
	async openSuitePicker(available: number, selected = 0) {
		const picker = new AddTestSuitesPicker(this.page);
		// The link beside the suites heading is there whether or not the plan has suites yet; the button under an
		// empty list is not.
		await this.text('Add Test Suites').first().click();
		await picker.expectCounts(available, selected);
		return picker;
	}

	async openMachineDrawer() {
		const drawer = new MachineProfilesDrawer(this.page);
		await this.linkTestMachineButton.click();
		await expect(drawer.userDefinedHeading).toBeVisible({ timeout: 30000 });
		return drawer;
	}

	// Test Plan Settings

	timeout(name: 'Page Timeout' | 'Step Timeout') {
		return this.main.getByRole('spinbutton', { name: `${name} (<=120 secs.)` });
	}

	timeoutTooLong(name: 'Page Timeout' | 'Step Timeout') {
		return this.text(`${name} should be less than or equal to 120`);
	}

	// A notification status chip is highlighted once chosen.
	statusChip(status: string) {
		return this.text(status);
	}

	async chooseStatus(status: string) {
		const chip = this.statusChip(status);
		if (!/bg-primary-50/.test((await chip.getAttribute('class')) ?? '')) {
			await chip.click();
		}
		await expect(chip).toHaveClass(/bg-primary-50/);
	}

	// A recovery action's row, e.g. "On Major Step Failure", with its radio buttons.
	settingsRow(text: string) {
		return this.main.getByRole('row').filter({ hasText: text });
	}
}
