/**
 * What every Testsigma page object shares: the browser page it drives, the page's main area, and the popups and
 * messages any page can show.
 *
 * Page objects own a page's locators and the steps done on it. The specs say what is tested and check the results,
 * calling the page objects for how to get there.
 */
import { expect, type Locator, type Page } from '@playwright/test';

export abstract class BasePage {
	readonly page: Page;
	readonly main: Locator;

	constructor(page: Page) {
		this.page = page;
		this.main = page.locator('main');
	}

	// The popup open over the page.
	get dialog() {
		return this.page.getByRole('dialog');
	}

	// A message shown at the top of the page, such as "Save point created successfully".
	message(text: string | RegExp) {
		return this.page.getByRole('alert').filter({ hasText: text });
	}

	// Messages stack up while they show, so wait for earlier ones to go before one that is to be checked.
	async waitForMessagesToGo() {
		await expect(this.page.getByRole('alert')).toHaveCount(0, { timeout: 30000 });
	}

	// Whether the browser flags a required field as left empty.
	static async isMissing(field: Locator) {
		return field.evaluate((input) => (input as HTMLInputElement).validity.valueMissing);
	}
}
