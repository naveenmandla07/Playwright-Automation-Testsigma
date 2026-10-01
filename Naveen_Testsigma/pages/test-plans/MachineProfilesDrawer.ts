/**
 * The "Select test machine profiles" drawer of the Create Test Plan wizard, and the Add Machine form it opens to
 * create a user-defined profile. Both are overlays rather than dialogs.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { dropdown, fieldLabel, openDropdown, overlay, turnOn } from '../components/FormControls';

const drawerTitle = 'Select test machine profiles';
const formTitle = 'Add test machine/device profile';

export class MachineProfilesDrawer {
	readonly page: Page;
	readonly root: Locator;

	constructor(page: Page) {
		this.page = page;
		this.root = overlay(page, drawerTitle, /^Save selections/);
	}

	text(text: string) {
		return this.root.getByText(text, { exact: true });
	}

	get userDefinedHeading() {
		return this.text('User-defined test machine profiles');
	}

	get predefinedHeading() {
		return this.text('Pre-defined test machine profiles');
	}

	get addMachineButton() {
		return this.root.getByRole('button', { name: 'Add Machine' });
	}

	// Shows how many profiles are selected, e.g. "Save selections(2)".
	get saveSelections() {
		return this.root.getByRole('button', { name: /^Save selections/ });
	}

	async openAddMachine() {
		await this.addMachineButton.click();
		return new AddMachineForm(this.page);
	}

	async save() {
		await this.saveSelections.click();
		await expect(this.page.getByText(drawerTitle, { exact: true })).toBeHidden({ timeout: 30000 });
	}
}

export class AddMachineForm {
	readonly page: Page;
	readonly root: Locator;

	constructor(page: Page) {
		this.page = page;
		this.root = overlay(page, formTitle, 'Create Profile');
	}

	text(text: string) {
		return this.root.getByText(text, { exact: true });
	}

	get title() {
		return this.text(formTitle);
	}

	get nameField() {
		return this.root.getByRole('textbox', { name: 'Name', exact: true });
	}

	get createProfileButton() {
		return this.root.getByRole('button', { name: 'Create Profile' });
	}

	get cancelButton() {
		return this.root.getByRole('button', { name: 'Cancel', exact: true });
	}

	fieldLabel(label: string) {
		return fieldLabel(this.root, label);
	}

	dropdown(label: string) {
		return dropdown(this.root, label);
	}

	checkbox(name: string) {
		return this.root.getByRole('checkbox', { name, exact: true });
	}

	radio(name: string) {
		return this.root.getByRole('radio', { name, exact: true });
	}

	// A test lab's button; its name ends with the lab's, e.g. "Testsigma Lab".
	labButton(lab: string) {
		return this.root.getByRole('button', { name: new RegExp(`${lab}$`) });
	}

	get deviceField() {
		return this.text('Device').locator('..').locator('[data-isopen]');
	}

	// Waits for the form to close, which it does once the profile is created or the form cancelled.
	async expectClosed() {
		await expect(this.page.getByText(formTitle, { exact: true })).toBeHidden({ timeout: 30000 });
	}

	// Local Devices runs on the user's own machine, so the form stops offering Testsigma's operating systems until
	// Testsigma Lab is chosen again. Switching back leaves the form unable to create its profile, so this is only done
	// on a form that is then cancelled.
	async switchTestLabs() {
		await this.root.getByRole('button', { name: /Local Devices$/ }).click();
		await expect(this.fieldLabel('OS & Version')).toBeHidden();
		await this.root.getByRole('button', { name: /Testsigma Lab$/ }).click();
		await expect(this.fieldLabel('OS & Version')).toBeVisible();
	}

	// Keeps the form's device unless an earlier profile already uses it, in which case it picks one that none does.
	// Returns the device the profile will use.
	async chooseUnusedDevice(used: string[]) {
		const current = (await this.deviceField.innerText()).trim();
		if (!used.includes(current)) {
			return current;
		}
		await this.deviceField.click();
		// The open list ticks the current device; the other devices are the entries next to it.
		const currentEntry = this.page.locator('div')
			.filter({ has: this.page.getByText(current, { exact: true }) })
			.filter({ has: this.page.getByTestId('check-circle') })
			.last();
		await expect(currentEntry).toBeVisible();
		const list = currentEntry.locator('xpath=..');
		await expect(list.locator('xpath=./div/span').first()).toBeVisible();
		const options = (await list.locator('xpath=./div/span').allInnerTexts()).map((text) => text.trim());
		const unused = options.find((option) => option && !used.includes(option));
		expect(unused, `a device other than ${used.join(', ')}`).toBeDefined();
		await list.getByText(unused!, { exact: true }).click();
		await expect(this.deviceField).toHaveText(unused!);
		return unused!;
	}

	// Picks an operating system and resolution, where given, and turns on the named options.
	async choose({ os, resolution, turnOn: options }: { os?: string; resolution?: string; turnOn: string[] }) {
		for (const [label, value] of [['OS & Version', os], ['Resolution', resolution]]) {
			if (!value) {
				continue;
			}
			const field = this.dropdown(label!);
			await openDropdown(field);
			await this.text(value).click();
			await expect(field).toContainText(value);
		}
		for (const option of options) {
			await turnOn(this.root, option);
		}
	}

	async createProfile() {
		await expect(this.createProfileButton).toBeEnabled();
		await this.createProfileButton.click();
		await this.expectClosed();
	}
}
