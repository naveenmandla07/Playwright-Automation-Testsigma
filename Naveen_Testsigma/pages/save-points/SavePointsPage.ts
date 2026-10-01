/**
 * The Save Points page, listing the account's save points as cards, newest first, with the popups for creating and
 * deleting one.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../BasePage';
import { SideNavigation } from '../components/SideNavigation';
import type { SavePoint, SavePointsApi } from './SavePointsApi';

// When a save point was made, e.g. "Wed | Sep 30 2026 | 17:26", or "Thu | Oct 1 2026 | 11:20" early in a month.
export const when = /^\w{3} \| \w{3} \d{1,2} \d{4} \| \d{2}:\d{2}$/;
// How a save point was made, as its card says.
export const typeLabels: Record<SavePoint['type'], string> = { MANUAL: 'Manual Save point', IMPORT: 'Import' };
// The longest name a save point can have.
export const nameLimit = 250;
// The page is given this long after it opens so everything it loads is shown before it is checked.
export const settleTime = 6000;

// A save point's card, a link to it showing when it was made, its name and how it was made.
export class SavePointCard {
	readonly root: Locator;

	constructor(root: Locator) {
		this.root = root;
	}

	// The first of the cards, when more than one save point has the same name.
	first() {
		return new SavePointCard(this.root.first());
	}

	// Shown while the card is hovered.
	get restoreButton() {
		return this.root.getByRole('button', { name: 'Restore', exact: true });
	}

	get openInNewTabButton() {
		return this.root.getByRole('button', { name: 'Open this Save point in new tab' });
	}

	get menuButton() {
		return this.root.getByTestId('more-vertical');
	}

	get editNoteOption() {
		return this.root.getByText('Edit Note', { exact: true });
	}

	get deleteOption() {
		return this.root.getByText('Delete Save Point', { exact: true });
	}

	async openMenu() {
		await this.root.hover();
		await this.menuButton.click();
	}

	// A card reads when the save point was made, its name, then how it was made, e.g.
	// "Wed | Sep 30 2026 | 17:26 dewdeferf Manual Save point".
	async read() {
		const text = (await this.root.innerText()).replace(/\s+/g, ' ').trim();
		const made = text.match(new RegExp(`^${when.source.slice(1, -1)}`))?.[0] ?? '';
		const how = Object.values(typeLabels).find((label) => text.endsWith(` ${label}`)) ?? '';
		return { made, name: text.slice(made.length, text.length - how.length).trim(), how };
	}
}

// The "Create a Save Point?" popup.
export class CreateSavePointDialog {
	readonly root: Locator;

	constructor(page: Page) {
		this.root = page.getByRole('dialog');
	}

	get heading() {
		return this.root.getByRole('heading', { name: 'Create a Save Point?' });
	}

	get infoIcon() {
		return this.root.getByRole('img', { name: 'info icon' });
	}

	get explanation() {
		return this.root.getByText(/This will create a save point of your current state of the version\. You can find them under Main menu > Save Points\./);
	}

	get nameField() {
		return this.root.getByRole('textbox', { name: 'Enter your Save point name' });
	}

	// The name's label, counting the characters used out of 250.
	nameLabel(used: number) {
		return this.root.getByText(new RegExp(`Name your Save point \\(${used}/${nameLimit}\\)\\*`));
	}

	nameCount(used: number) {
		return this.root.getByText(new RegExp(`\\(${used}/${nameLimit}\\)`));
	}

	get createButton() {
		return this.root.getByRole('button', { name: 'Create', exact: true });
	}

	get cancelButton() {
		return this.root.getByRole('button', { name: 'Cancel', exact: true });
	}
}

// The "Delete this Save point?" popup, which asks for "DELETE" to be typed first.
export class DeleteSavePointDialog {
	readonly root: Locator;

	constructor(page: Page) {
		this.root = page.getByRole('dialog');
	}

	get title() {
		return this.root.getByText('Delete this Save point?', { exact: true });
	}

	get warning() {
		return this.root.getByText('Deleting the save point will erase all the backup data associated with it.', { exact: true });
	}

	get typeToConfirm() {
		return this.root.getByText(/Please type 'DELETE' to confirm/);
	}

	get cannotBeUndone() {
		return this.root.getByText(/This action cannot be undone\./);
	}

	get confirmField() {
		return this.root.getByRole('textbox', { name: "Enter 'DELETE' to confirm." });
	}

	get deleteButton() {
		return this.root.getByRole('button', { name: 'I understand, Delete Save Point' });
	}

	get cancelButton() {
		return this.root.getByRole('button', { name: 'Cancel', exact: true });
	}
}

export class SavePointsPage extends BasePage {
	readonly api: SavePointsApi;
	readonly heading = this.main.getByRole('heading', { name: 'Save Points', level: 1 });
	readonly createButton = this.main.getByRole('button', { name: 'Create Save Point' });
	readonly createDialog = new CreateSavePointDialog(this.page);
	readonly deleteDialog = new DeleteSavePointDialog(this.page);

	constructor(page: Page, api: SavePointsApi) {
		super(page);
		this.api = api;
	}

	async open() {
		await this.page.goto('save_points');
		await expect(this.heading).toBeVisible({ timeout: 30000 });
		await this.page.waitForTimeout(settleTime);
	}

	async openFromNavigation() {
		await new SideNavigation(this.page).link('Save Points').click();
		await expect(this.page).toHaveURL(/\/ui\/save_points$/, { timeout: 30000 });
		await expect(this.heading).toBeVisible();
		await expect(this.createButton).toBeEnabled();
		await this.page.waitForTimeout(settleTime);
	}

	// The save points' cards, newest first.
	get cards() {
		return this.main.getByRole('link').filter({ hasText: new RegExp(when.source.slice(1, -1)) });
	}

	card(name: string) {
		return new SavePointCard(this.cards.filter({ has: this.page.getByText(name, { exact: true }) }));
	}

	// The names of the listed save points, newest first.
	async listedNames() {
		return Promise.all((await this.cards.all()).map(async (card) => (await new SavePointCard(card).read()).name));
	}

	async openCreateDialog() {
		await this.createButton.click();
		await expect(this.createDialog.heading).toBeVisible();
		return this.createDialog;
	}

	// Creates a save point from the popup and checks Testsigma made it.
	async create(name: string) {
		await this.waitForMessagesToGo();
		const dialog = await this.openCreateDialog();
		await dialog.nameField.fill(name);
		await dialog.createButton.click();
		await expect(this.message('Save point created successfully')).toBeVisible({ timeout: 120000 });
		await expect(this.card(name).root).toBeVisible({ timeout: 30000 });
	}

	async openDeleteDialog(name: string) {
		await this.card(name).openMenu();
		await this.page.getByText('Delete Save Point', { exact: true }).click();
		return this.deleteDialog;
	}

	/**
	 * Deletes a save point from its menu, typing "DELETE" to confirm, and checks Testsigma no longer has it. The list
	 * usually drops it straight away, but has been seen to keep showing it until reloaded; returns whether the page had
	 * to be reloaded for that.
	 */
	async delete(name: string) {
		await this.waitForMessagesToGo();
		const dialog = await this.openDeleteDialog(name);
		await expect(dialog.title).toBeVisible();
		await dialog.confirmField.fill('DELETE');
		await expect(dialog.deleteButton).toBeEnabled();
		await dialog.deleteButton.click();
		await expect(this.message('Save Point deleted successfully')).toBeVisible({ timeout: 60000 });
		await expect.poll(async () => (await this.api.list()).some((point) => point.description === name), { message: `${name} deleted`, timeout: 30000 }).toBe(false);
		try {
			await expect(this.card(name).root).toHaveCount(0, { timeout: 10000 });
			return false;
		} catch {
			await this.open();
			await expect(this.card(name).root).toHaveCount(0);
			return true;
		}
	}

	/**
	 * With the list full, another save point cannot even be started: "Create Save Point" is disabled. Hovering the
	 * button may say why; returns what it says.
	 */
	async expectCreateRefused() {
		await expect(this.createButton).toBeDisabled();
		await this.createButton.locator('xpath=..').hover();
		const why = this.page.getByRole('tooltip');
		return (await why.count()) ? `disabled: ${(await why.first().innerText()).trim()}` : 'disabled';
	}
}
