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
import { PlansAndBillingTab } from '../../pages/settings/tabs/PlansAndBillingTab';
import { useSettingsTab } from '../../support/admin-settings';
import { escapeRegExp } from '../../support/common';

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
	const run = useSettingsTab(PlansAndBillingTab);

	test('Open the Plans & Billing tab and check its elements', async () => {
		await run.tab.open();
		await run.tab.expectElements();
	});

	test('Check the account\'s plan', async () => {
		const plan = run.tab.accountPlan;
		await expect(plan).toBeVisible();
		test.info().annotations.push({ type: 'plan', description: (await plan.innerText()).trim() });
		await expect(run.tab.parallels).toBeVisible();
		const trial = run.tab.trial;
		if (await trial.isVisible()) {
			// A trial says when it ends and offers to upgrade.
			await expect(run.tab.text(/^Your trial will expire on \w{3} \d{1,2}, \d{4}$/)).toBeVisible();
			await expect(run.tab.upgradeButton).toBeEnabled();
			test.info().annotations.push({ type: 'trial', description: (await run.tab.trialEnd.innerText()).trim() });
		}
		// What the plan includes.
		for (const allowance of [/^\d+$/, /^Parallel Tests$/, /^Allowed Queue$/, /^Free cloud automated minutes$/, /^Free local automated minutes$/]) {
			await expect.soft(run.tab.text(allowance).first(), String(allowance)).toBeVisible();
		}
		await expect.soft(run.tab.text('Unlimited')).toHaveCount(2);
	});

	test('Check the billing details and open the edit form', async () => {
		await expect(run.tab.text('Billing details')).toBeVisible();
		await run.tab.editDetailsButton.click();
		const form = run.tab.dialog;
		await expect(form.getByText('Edit Billing details', { exact: true })).toBeVisible();
		await expect(form.getByRole('textbox', { name: 'accountadmin@company.com' })).toBeVisible();
		// The form holds the billing address shown on the tab.
		for (const field of billingFields) {
			const box = form.getByRole('textbox', { name: field, exact: true });
			await expect.soft(box, field).not.toHaveValue('');
			const value = await box.inputValue();
			await expect.soft(run.tab.text(new RegExp(escapeRegExp(value))).first(), `${field} shown on the tab`).toBeVisible();
		}
		await expect(form.getByText(/^Country\*?/)).toBeVisible();
		await expect(form.getByRole('button', { name: 'Update', exact: true })).toBeVisible();
		await form.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(form).toHaveCount(0);
	});

	test('Check the billing history and how to reach support', async () => {
		await expect(run.tab.billingHistory).toBeVisible();
		await expect(run.tab.text(/^For payment or plan related queries, Please contact Testsigma Support through/)).toBeVisible();
		await expect(run.tab.link('Chat')).toHaveAttribute('href', 'javascript:fcWidget.open()');
		const email = run.tab.link('support@testsigma.com');
		await expect(email).toHaveAttribute('href', 'mailto:support@testsigma.com');
		await expect(email).toHaveAttribute('target', '_blank');
	});

	for (const plan of plans) {
		test(`Check the ${plan.name} plan on offer`, async () => {
			await expect(run.tab.planHeading(plan.name)).toBeVisible();
			const card = run.tab.planCard(plan.name, plans.filter((other) => other.name !== plan.name).map((other) => other.name));
			await expect(card.getByText(plan.for, { exact: true })).toBeVisible();
			await expect(card.getByRole('button', { name: plan.parallels, exact: true })).toBeVisible();
			await expect(card.getByRole('button', { name: 'Contact Sales' })).toBeVisible();
			for (const feature of plan.includes) {
				await expect.soft(card.getByText(feature, { exact: true }), feature).toBeVisible();
			}
			// Each plan can be asked about.
			await expect(run.tab.contactSalesButtons).toHaveCount(plans.length);
		});
	}

	test('One of the plans on offer is marked as the current plan', async () => {
		await expect(run.tab.text('Current plan')).toHaveCount(1);
	});
});
