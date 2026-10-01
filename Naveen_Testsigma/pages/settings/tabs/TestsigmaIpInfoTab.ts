/**
 * The Testsigma IP info tab: the server version and the addresses of Testsigma's servers and lab, each with a copy
 * icon.
 */
import type { Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class TestsigmaIpInfoTab extends SettingsTabPage {
	readonly version = this.paragraph(/^v\d+\.\d+\.\d+/);
	// Each address has a copy icon of its own, in the same order.
	readonly copyIcons = this.main.getByTestId('content-copy-sm');

	constructor(page: Page) {
		super(page, 'Testsigma IP info');
	}

	// The addresses listed after a heading, up to the next heading or the end.
	async addressesAfter(heading: string) {
		const texts = (await this.main.getByRole('paragraph').allInnerTexts()).map((text) => text.trim());
		const start = texts.indexOf(heading) + 1;
		const addresses: string[] = [];
		for (const text of texts.slice(start)) {
			if (!/^\d/.test(text)) {
				break;
			}
			addresses.push(text);
		}
		return addresses;
	}

	// What the page has put on the clipboard.
	async clipboard() {
		return this.page.evaluate(() => navigator.clipboard.readText());
	}
}
