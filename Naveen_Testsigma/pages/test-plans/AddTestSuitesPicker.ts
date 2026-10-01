/**
 * The "Add Test Suites to plan" picker, an overlay over the Create Test Plan wizard. Its left list holds the suites
 * available to the plan and its right list those selected for it.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { overlay } from '../components/FormControls';

const title = 'Add Test Suites to plan';

export class AddTestSuitesPicker {
	readonly page: Page;
	readonly root: Locator;

	constructor(page: Page) {
		this.page = page;
		this.root = overlay(page, title, 'Add to Plan');
	}

	text(text: string) {
		return this.root.getByText(text, { exact: true });
	}

	// The title anywhere on the page, which is gone once the picker closes.
	get pageTitle() {
		return this.page.getByText(title, { exact: true });
	}

	button(name: 'Select' | 'Remove' | 'Cancel') {
		return this.root.getByRole('button', { name, exact: true });
	}

	get addToPlanButton() {
		return this.root.getByRole('button', { name: 'Add to Plan' });
	}

	async expectCounts(available: number, selected: number) {
		await expect(this.text(`Available Test Suites (${available})`)).toBeVisible({ timeout: 30000 });
		await expect(this.text(`Selected for Test plan (${selected})`)).toBeVisible();
	}

	// Each suite has a checkbox named after it, in whichever of the two lists it is.
	suite(name: string) {
		// "Select All" would also match "Select All test cases…", so match each name exactly.
		return this.root.getByRole('checkbox', { name: `Select ${name}`, exact: true }).first();
	}

	// Ticks a suite's checkbox in whichever list it is.
	async tick(name: string) {
		const checkbox = this.suite(name);
		await expect(checkbox).toBeVisible();
		await checkbox.check();
		await expect(checkbox).toBeChecked();
	}

	selectAll(list: 'available' | 'selected') {
		const checkboxes = this.root.getByRole('checkbox', { name: 'Select All', exact: true });
		return list === 'available' ? checkboxes.first() : checkboxes.last();
	}

	// The search box stays collapsed until its icon is clicked.
	get searchIcon() {
		return this.root.getByTestId('search').first();
	}

	get search() {
		return this.root.getByRole('textbox', { name: 'Search' }).first();
	}

	// A filter's options open in a popover under its name; the search-based ones show a search box of their own.
	get visibleSearchBoxes() {
		return this.root.getByRole('textbox', { name: 'Search' }).filter({ visible: true });
	}

	get visibleCheckboxes() {
		return this.root.getByRole('checkbox').filter({ visible: true });
	}

	checkbox(name: string) {
		return this.root.getByRole('checkbox', { name, exact: true });
	}

	// A filter's name, which opens its options.
	filter(name: string) {
		return this.text(name).first();
	}

	// A month button of a date filter's calendar, e.g. "October 2026".
	monthButton(month: string) {
		return this.root.getByRole('button', { name: month, exact: true });
	}

	// The picker's popovers ignore Escape and close on a click elsewhere, such as on the picker's title.
	async closePopover() {
		await this.text(title).click();
	}

	async cancel() {
		await this.button('Cancel').click();
		await expect(this.pageTitle).toBeHidden();
	}

	async addToPlan() {
		await this.addToPlanButton.click();
		await expect(this.pageTitle).toBeHidden();
	}
}
