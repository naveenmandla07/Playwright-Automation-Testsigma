/**
 * The Plans & Billing tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Plans & Billing tab and check its elements.
 * - Check the account's plan: its name and state, its parallels, and what it includes.
 * - Check the billing details, and open "Edit details" to check the form holds them, then cancel it.
 * - Check the billing history and how to reach Testsigma support about payments.
 * - Check the Pro and Enterprise plans on offer, with what each includes.
 *
 * Nothing is changed or bought: "Update", "Add Card & Upgrade" and "Contact Sales" are checked but never clicked,
 * and the edit form is cancelled. The plan and billing details belong to the account, so they are read from the
 * page.
 */
import { expect, test } from '@playwright/test';
import { expectTabElements, openTab, useSettingsTab } from '../support/admin-settings';

const plans = [
	{
		name: 'Pro',
		for: 'For fast-growing teams',
		parallels: 'Upto 25 parallels',
		includes: [
			'Parallel execution', '1000+ Desktop browser/OS combos', '3000+ Real mobile and tablet devices',
			'50GB storage & 60 days of data retention', '20+ integrations including Slack, Jira',
		],
	},
	{
		name: 'Enterprise',
		for: 'For TCOEs and multiple large teams',
		parallels: 'For 25+ parallels',
		includes: [
			'Everything in Pro, plus:', 'Public, Private, On-Prem cloud deployment', '2FA automation (Email & SMS)',
			'Unlimited Storage and Data Retention', 'IP Whitelisting & Local Testing Support', 'Geo-location and Network Throttling',
			'Multi-agent setup', '24*7*365 dedicated support',
		],
	},
];

const billingFields = ['Address line 1', 'Address line 2', 'City', 'State', 'Zipcode'];

test.describe('Verify the Plans and Billing', () => {
	const run = useSettingsTab('Plans & Billing');

	test('Open the Plans & Billing tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
	});

	test('Check the account\'s plan', async () => {
		const plan = run.main.getByText(/^\w+ Plan$/).first();
		await expect(plan).toBeVisible();
		test.info().annotations.push({ type: 'plan', description: (await plan.innerText()).trim() });
		await expect(run.main.getByText(/^\d+ Parallel$/).first()).toBeVisible();
		const trial = run.main.getByText('In Trial', { exact: true });
		if (await trial.isVisible()) {
			// A trial says when it ends and offers to upgrade.
			await expect(run.main.getByText(/^Your trial will expire on \w{3} \d{1,2}, \d{4}$/)).toBeVisible();
			await expect(run.main.getByRole('button', { name: 'Add Card & Upgrade' })).toBeEnabled();
			test.info().annotations.push({ type: 'trial', description: (await run.main.getByText(/^Your trial will expire on/).innerText()).trim() });
		}
		// What the plan includes.
		for (const allowance of [/^\d+$/, /^Parallel Tests$/, /^Allowed Queue$/, /^Free cloud automated minutes$/, /^Free local automated minutes$/]) {
			await expect.soft(run.main.getByText(allowance).first(), String(allowance)).toBeVisible();
		}
		await expect.soft(run.main.getByText('Unlimited', { exact: true })).toHaveCount(2);
	});

	test('Check the billing details and open the edit form', async () => {
		await expect(run.main.getByText('Billing details', { exact: true })).toBeVisible();
		await run.main.getByRole('button', { name: 'Edit details' }).click();
		const form = run.page.getByRole('dialog');
		await expect(form.getByText('Edit Billing details', { exact: true })).toBeVisible();
		await expect(form.getByRole('textbox', { name: 'accountadmin@company.com' })).toBeVisible();
		// The form holds the billing address shown on the tab.
		for (const field of billingFields) {
			const box = form.getByRole('textbox', { name: field, exact: true });
			await expect.soft(box, field).not.toHaveValue('');
			const value = await box.inputValue();
			await expect.soft(run.main.getByText(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).first(), `${field} shown on the tab`).toBeVisible();
		}
		await expect(form.getByText(/^Country\*?/)).toBeVisible();
		await expect(form.getByRole('button', { name: 'Update', exact: true })).toBeVisible();
		await form.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(form).toHaveCount(0);
	});

	test('Check the billing history and how to reach support', async () => {
		await expect(run.main.getByRole('heading', { name: 'Billing history', level: 2 })).toBeVisible();
		await expect(run.main.getByText(/^For payment or plan related queries, Please contact Testsigma Support through/)).toBeVisible();
		await expect(run.main.getByRole('link', { name: 'Chat', exact: true })).toHaveAttribute('href', 'javascript:fcWidget.open()');
		const email = run.main.getByRole('link', { name: 'support@testsigma.com', exact: true });
		await expect(email).toHaveAttribute('href', 'mailto:support@testsigma.com');
		await expect(email).toHaveAttribute('target', '_blank');
	});

	for (const plan of plans) {
		test(`Check the ${plan.name} plan on offer`, async () => {
			const heading = run.main.getByRole('heading', { name: plan.name, level: 1 });
			await expect(heading).toBeVisible();
			// Each plan on offer is a card of its own. The account's own plan is described above them in the same
			// words, so each plan is checked within its card.
			const otherPlans = plans.filter((other) => other.name !== plan.name);
			let card = run.main.locator('div').filter({ has: run.page.getByRole('heading', { name: plan.name, level: 1 }) });
			for (const other of otherPlans) {
				card = card.filter({ hasNot: run.page.getByRole('heading', { name: other.name, level: 1 }) });
			}
			// The largest part of the page with this plan and no other is its card.
			card = card.first();
			await expect(card.getByText(plan.for, { exact: true })).toBeVisible();
			await expect(card.getByRole('button', { name: plan.parallels, exact: true })).toBeVisible();
			await expect(card.getByRole('button', { name: 'Contact Sales' })).toBeVisible();
			for (const feature of plan.includes) {
				await expect.soft(card.getByText(feature, { exact: true }), feature).toBeVisible();
			}
			// Each plan can be asked about.
			await expect(run.main.getByRole('button', { name: 'Contact Sales' })).toHaveCount(plans.length);
		});
	}

	test('One of the plans on offer is marked as the current plan', async () => {
		await expect(run.main.getByText('Current plan', { exact: true })).toHaveCount(1);
	});
});
