/**
 * The side navigation shown on every page once signed in. It only shows its labels while hovered.
 */
import { expect, type Page } from '@playwright/test';

export class SideNavigation {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	get root() {
		return this.page.getByRole('navigation');
	}

	// Shows the labels by hovering at the given height. Moving onto the spot the pointer is already on does not count
	// as hovering, so move away first.
	async hover(y: number) {
		await this.page.mouse.move(800, 500);
		await this.page.mouse.move(20, y);
	}

	link(name: string) {
		return this.root.getByRole('link', { name });
	}

	// Opens a page grouped under Test Data, e.g. "Environments", hovering the navigation so its labels show.
	async openUnderTestData(name: string, { exact }: { exact?: boolean } = {}) {
		await this.page.mouse.move(20, 300);
		await this.page.getByRole('button', { name: 'Test Data', exact: true }).click();
		await this.page.getByRole('link', { name, exact }).click();
	}

	// The profile menu at the bottom shows the user's initial, name and role; it is matched by its structure so any
	// account works.
	get profileMenu() {
		return this.root.locator('div.cursor-pointer')
			.filter({ has: this.page.getByTestId('angle-right') })
			.filter({ has: this.page.getByText(/^[A-Z]$/) });
	}

	// Logs out from the profile menu, hovering near the bottom of the navigation so the menu shows.
	async logOut() {
		const viewport = this.page.viewportSize();
		await this.page.mouse.move(20, (viewport?.height ?? 720) - 20);
		await expect(this.profileMenu).toBeVisible();
		await this.profileMenu.click();

		const logoutOption = this.page.getByText('Logout', { exact: true });
		await expect(logoutOption).toBeVisible();
		await logoutOption.click();
	}
}
