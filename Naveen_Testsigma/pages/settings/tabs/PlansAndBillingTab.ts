/**
 * The Plans & Billing tab: the account's plan, its billing details and history, and the plans on offer.
 */
import type { Page } from '@playwright/test';
import { SettingsTabPage } from '../SettingsPage';

export class PlansAndBillingTab extends SettingsTabPage {
	readonly accountPlan = this.main.getByText(/^\w+ Plan$/).first();
	readonly parallels = this.main.getByText(/^\d+ Parallel$/).first();
	readonly trial = this.text('In Trial');
	readonly trialEnd = this.main.getByText(/^Your trial will expire on/);
	readonly upgradeButton = this.main.getByRole('button', { name: 'Add Card & Upgrade' });
	readonly editDetailsButton = this.main.getByRole('button', { name: 'Edit details' });
	readonly billingHistory = this.main.getByRole('heading', { name: 'Billing history', level: 2 });
	readonly contactSalesButtons = this.main.getByRole('button', { name: 'Contact Sales' });

	constructor(page: Page) {
		super(page, 'Plans & Billing');
	}

	planHeading(name: string) {
		return this.main.getByRole('heading', { name, level: 1 });
	}

	// Each plan on offer is a card of its own. The account's own plan is described above them in the same words, so
	// each plan is checked within its card: the largest part of the page with this plan and no other.
	planCard(name: string, otherPlans: string[]) {
		// Filters are matched inside each div, so the headings are found from the page rather than from main.
		const heading = (plan: string) => this.page.getByRole('heading', { name: plan, level: 1 });
		let card = this.main.locator('div').filter({ has: heading(name) });
		for (const other of otherPlans) {
			card = card.filter({ hasNot: heading(other) });
		}
		return card.first();
	}
}
