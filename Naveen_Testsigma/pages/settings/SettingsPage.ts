/**
 * Admin Settings: the Settings page with its list of tabs, and what every tab has in common. Each tab's own page
 * object extends SettingsTabPage with what only that tab shows.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { escapeRegExp } from '../../support/common';
import { BasePage } from '../BasePage';
import { findTab, tabs, type SettingsTab } from './settingsTabs';

// Each tab is given this long after it opens so everything it loads is shown before it is checked.
export const settleTime = 6000;

// Lists are searched on the server, which can take a while to answer. Each attempt at a search waits
// searchAttemptTime for its results before the search is typed again (see searchFor); other waits for a search's
// results, such as for "No results", are given searchTime.
export const searchAttemptTime = 10000;
export const searchTime = 15000;

export class SettingsPage extends BasePage {
	readonly heading = this.main.getByRole('heading', { name: 'Admin Settings', level: 1 });

	// Settings opens on its first tab, with the tab list beside it.
	async openSettings() {
		await this.page.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true }).click();
		await expect(this.page).toHaveURL(/\/ui\/settings\/plugs$/, { timeout: 30000 });
		await expect(this.heading).toBeVisible({ timeout: 30000 });
	}

	// A tab in the tab list.
	tabButton(name: string) {
		return this.main.getByRole('button', { name, exact: true });
	}

	// The names of the buttons the page starts with; the tab list comes first.
	async firstButtonNames(count: number) {
		return (await this.main.getByRole('button').allInnerTexts()).map((text) => text.trim()).slice(0, count);
	}

	// Exact text, or a pattern for text with a number that changes.
	text(text: string | RegExp) {
		return typeof text === 'string' ? this.main.getByText(text, { exact: true }) : this.main.getByText(text);
	}

	button(name: string | RegExp) {
		return typeof name === 'string' ? this.main.getByRole('button', { name, exact: true }) : this.main.getByRole('button', { name });
	}

	link(name: string) {
		return this.main.getByRole('link', { name, exact: true });
	}

	// A tab's page is headed by its title. Most titles repeat the tab's name, which the tab list already shows, so the
	// title must appear once more than the tab list accounts for.
	async expectTitle(tab: SettingsTab) {
		const title = tab.title ?? tab.name;
		const inTabList = tabs.some((other) => other.name === title) ? 1 : 0;
		const shown = this.text(title);
		await expect.poll(() => shown.count(), { message: `title ${title}`, timeout: 30000 }).toBeGreaterThan(inTabList);
		await expect(shown.last()).toBeVisible();
	}

	// Opens a tab from the tab list, checks its address and title, and gives it time to finish loading.
	async openTab(tab: SettingsTab) {
		await this.tabButton(tab.name).click();
		await expect(this.page).toHaveURL(new RegExp(`/ui/settings/${tab.path}$`), { timeout: 30000 });
		await this.expectTitle(tab);
		await this.page.waitForTimeout(settleTime);
	}

	// Goes back to a tab afresh, as though opened from the tab list, leaving behind whatever an earlier check did.
	async reopenTab(tab: SettingsTab) {
		await this.page.goto(`settings/${tab.path}`);
		await this.expectTitle(tab);
		await this.page.waitForTimeout(settleTime);
	}

	// Each element is checked on its own, so a run reports every element missing from a tab rather than only the
	// first.
	async expectTabElements(tab: SettingsTab) {
		const main = this.main;
		for (const text of tab.texts ?? []) {
			await expect.soft(this.text(text).last(), `text ${text}`).toBeVisible();
		}
		for (const name of tab.buttons ?? []) {
			await expect.soft(this.button(name).last(), `button ${name}`).toBeVisible();
		}
		for (const name of tab.links ?? []) {
			await expect.soft(this.link(name).last(), `link ${name}`).toBeVisible();
		}
		for (const name of tab.textboxes ?? []) {
			await expect.soft(main.getByRole('textbox', { name, exact: true }).last(), `textbox ${name}`).toBeVisible();
		}
		for (const name of tab.checkboxes ?? []) {
			await expect.soft(main.getByRole('checkbox', { name, exact: true }).last(), `toggle ${name}`).toBeVisible();
		}
		for (const name of tab.radios ?? []) {
			await expect.soft(main.getByRole('radio', { name: new RegExp(`^${escapeRegExp(name)}`) }), `option ${name}`).toBeVisible();
		}
		for (const name of tab.headings ?? []) {
			await expect.soft(main.getByRole('heading', { name, exact: true }).last(), `heading ${name}`).toBeVisible();
		}
		for (const name of tab.images ?? []) {
			await expect.soft(main.getByRole('img', { name, exact: true }).last(), `image ${name}`).toBeVisible();
		}
		if (tab.table) {
			await expect.soft(main.getByRole('grid').first(), 'table').toBeVisible();
		}
		await tab.extra?.(main);
	}

	/**
	 * Searches a tab's list and waits for the results to satisfy expectResults. A search typed while the tab is still
	 * loading can be lost, leaving the list as it was, so the term is typed again until the results arrive.
	 */
	async searchFor(box: Locator, term: string, expectResults: () => Promise<void>) {
		await expect(async () => {
			await box.clear();
			await box.pressSequentially(term);
			await expectResults();
		}).toPass({ timeout: 60000 });
	}

	/**
	 * Opens a menu of options, such as "Sort by", and checks each option is shown. An option can share its text with
	 * something already on the tab, such as a column heading, so each must add one more of its text to the tab, or to
 * the part of it given, such as a popup.
	 */
	async expectMenuOptions(open: () => Promise<void>, options: string[], scope: Locator = this.main) {
		const shown = (option: string) => scope.getByText(option, { exact: true }).filter({ visible: true });
		const before = await Promise.all(options.map((option) => shown(option).count()));
		await open();
		for (const [index, option] of options.entries()) {
			await expect.soft(shown(option), `option ${option}`).toHaveCount(before[index] + 1);
		}
	}
}

// One tab of Admin Settings. Each tab's page object passes its name, and adds what only that tab shows.
export class SettingsTabPage extends SettingsPage {
	readonly tab: SettingsTab;

	constructor(page: Page, name: string) {
		super(page);
		this.tab = findTab(name);
	}

	// Whether the page is on this tab.
	isOpen() {
		return new URL(this.page.url()).pathname.endsWith(`/settings/${this.tab.path}`);
	}

	// Opens the tab from the tab list.
	async open() {
		await this.openTab(this.tab);
	}

	async reopen() {
		await this.reopenTab(this.tab);
	}

	async expectElements() {
		await this.expectTabElements(this.tab);
	}

	// The tab's search box, on tabs that have one.
	get search() {
		return this.main.getByRole('textbox', { name: 'Search', exact: true });
	}

	// What a tab, or a list on it, shows when it holds nothing.
	get emptyState() {
		return this.main.getByRole('img', { name: 'Empty state illustration' });
	}

	paragraph(text: string | RegExp) {
		return this.main.getByRole('paragraph').filter({ hasText: text });
	}

	// The tab's table; each of its entries is a row inside the grid's own wrapping row.
	get table() {
		return this.main.getByRole('grid');
	}

	get rows() {
		return this.table.getByRole('row').getByRole('row');
	}

	// The tab's preference switch, drawn over the checkbox that names it.
	switchOf(name: string) {
		return this.main.getByRole('checkbox', { name, exact: true });
	}
}
