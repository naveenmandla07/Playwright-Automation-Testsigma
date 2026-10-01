/**
 * The Integrations tab: its category tabs and a card for every integration, each with its own switch and, once set
 * up, a "Manage" button.
 */
import type { Locator, Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

// An integration as the page names it; match is for a name that cannot be matched exactly, such as one split over
// two lines.
type IntegrationName = { name: string; match?: RegExp };

export class IntegrationsTab extends SettingsTabPage {
	readonly learnMoreLinks = this.main.getByRole('link', { name: 'Learn more' });

	constructor(page: Page) {
		super(page, 'Integrations');
	}

	// A category tab, such as "Bug Reporting".
	category(name: string) {
		return this.text(name).first();
	}

	async showAll() {
		await this.text('All Integrations').click();
	}

	nameOf(integration: IntegrationName) {
		return integration.match ? this.main.getByText(integration.match) : this.text(integration.name);
	}

	// An integration's card holds its logo, name, description, "Learn more" link and switch.
	cardOf(integration: IntegrationName) {
		return this.nameOf(integration).first().locator("xpath=ancestor::div[.//a[normalize-space()='Learn more']][1]");
	}

	// The switch's checkbox is only there for screen readers; the switch drawn beside it is what takes the click.
	cardSwitch(card: Locator) {
		return card.getByRole('checkbox');
	}

	async switchOn(card: Locator) {
		await this.cardSwitch(card).locator('..').getByTestId('toggle-switch').click();
	}

	manageButton(card: Locator) {
		return card.getByRole('button', { name: 'Manage', exact: true });
	}

	// The names of the integrations the page is showing, in order, with line breaks inside a name read as spaces.
	async shownIntegrations() {
		return this.page.evaluate(() =>
			[...document.querySelectorAll('main img[alt="logo"]')]
				.filter((logo) => (logo as HTMLElement).offsetParent !== null)
				.map((logo) => ((logo.nextElementSibling as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ').trim()),
		);
	}
}
