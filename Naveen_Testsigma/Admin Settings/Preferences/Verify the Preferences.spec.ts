/**
 * The Preferences tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Preferences tab and check its elements.
 * - Check each preference: its title, its description and its switch, noting whether it is on or off.
 * - Check the sections the preferences are grouped under and the explanation of who can stop executions.
 * - Check the switches that cannot be used: the deprecated plan-level accessibility testing, and self-review
 *   while review management is off.
 * - Check the Copilot & Recorder Extension choices, exactly one of which is chosen.
 *
 * Every preference applies to the whole account as soon as it is changed, so nothing on this tab is clicked; the
 * switches are checked for what they show, and whether each is on or off is noted rather than expected.
 */
import { expect, test } from '@playwright/test';
import { PreferencesTab } from '../../pages/settings/tabs/PreferencesTab';
import { useSettingsTab } from '../../support/admin-settings';
import { escapeRegExp } from '../../support/common';

type Preference = { name: string; description: string | RegExp };

const preferences: Preference[] = [
	{
		name: 'Auto Healing',
		description: 'During a test run, if an element fails, the Auto Healing feature in Testsigma automatically corrects the Element. Testsigma Smart AI identifies the changes in a new build without manual intervention and corrects Elements.',
	},
	// Its description is the list explaining what turning it on changes, checked on its own.
	{ name: 'Control Who can Stop Executions', description: /^1\.OFF \[Default\]/ },
	{
		name: 'Design Visual Validations',
		description: 'Compare execution screenshots against Figma design assets (requires the Figma integration to be configured).',
	},
	{
		name: 'Test Case Review Management',
		description: 'Enables Test Managers to perform Test Case Reviews and Share Feedback to team members all at one place.',
	},
	{ name: 'Element Review Management', description: 'Enables Element Review by Test Managers.' },
	{
		name: 'Self-Review Management',
		description: 'If enabled, this will allow the Test Developers to review Test Cases and Elements on their own.',
	},
	{
		name: 'Highlight element in screenshot',
		description: 'During a test run user will be able to identify objects in the screenshots with which they have interacted. Thus making their debugging experience better. (Note - This setting is applicable only to steps which contains an element in web)',
	},
	{ name: 'Screenshot with timestamp', description: 'When enabled, execution screenshots are overlaid with the capture timestamp.' },
	{
		name: 'Test case level multi driver session',
		description: 'Allows naming and running multiple driver sessions within a single test case. When enabled, the launch app step exposes a session name field for local executions.',
	},
	{
		name: 'Detailed accessibility report',
		description: 'When enabled, the accessibility detailed PDF report includes a highlighted screenshot for every occurrence of an issue. When disabled, a brief report with a single sample screenshot per issue is generated.',
	},
	{
		name: 'Use asset proxy',
		description: 'When enabled, test assets are routed through the Testsigma asset proxy instead of being accessed directly from storage.',
	},
	{
		name: 'Use CDN signed URLs',
		description: 'When enabled, test assets are served via time-limited signed CDN URLs for improved delivery performance and security.',
	},
	{
		name: 'Web Accessibility Testing - Plan level',
		description: 'Enables users to perform accessibility testing for web / salesforce applications at plan level',
	},
	{
		name: 'Web Accessibility Testing - Step level',
		description: 'Enables users to perform accessibility testing for web / salesforce applications at step level',
	},
	{ name: 'Generative AI features', description: 'This enables Generative AI capabilities' },
	{ name: 'Generative AI Autoheal', description: 'Use Generative AI to automatically heal broken element locators during execution.' },
	{ name: 'Agentic AI', description: 'Leverage AI Agents to Generate, Maintain, Plan, and Analyze Your Tests.' },
	{
		name: 'Autonomous Testing',
		description: 'Save loads of time by utilizing AI Agents to analyze your test results to identify the issues and create comprehensive bug reports with minimal effort.',
	},
	{
		name: 'Generator (Live App)',
		// The page's own wording, "learn you live application", is kept as it is shown.
		description: 'Utilize Generator Agent to learn you live application and create executable test cases directly from business requirements.',
	},
	{
		name: 'Analyzer & Bug Reporter',
		description: 'Automate Test Case Generation through seamless tool integration with Github and always stay ahead of the curve.',
	},
];

// Preferences grouped under a heading of their own, with the heading's description.
const sections = [
	{
		heading: 'Review Management',
		description: 'Review Management in Testsigma enables Test Managers to manage all review-related activities for Test Cases and Elements',
		preferences: ['Test Case Review Management', 'Element Review Management', 'Self-Review Management'],
	},
	{
		heading: 'Web Accessibility Testing',
		description: 'Web Accessibility Testing in Testsigma enables users to perform accessibility testing for web applications',
		preferences: ['Web Accessibility Testing - Plan level', 'Web Accessibility Testing - Step level'],
	},
];

const recorderChoices = [
	{ name: 'Automatic (default)', description: 'Testsigma loads its bundled recorder extension into the browser on every session.' },
	{ name: 'Managed profile', description: 'The Chrome Web Store recorder extension is installed once into a Testsigma-managed browser profile and reused across sessions.' },
	{ name: 'Your own browser profile', description: 'Sessions run in a browser profile your team manages; the recorder extension must be installed in that profile.' },
];

// A description matched whole. Parts of a description can sit in elements of their own, such as a note, which the
// page shows with a space but may join without one, so the space between two words may be any spacing or none.
function asText(description: string | RegExp) {
	if (typeof description !== 'string') {
		return description;
	}
	const words = description.split(' ').map((word) => escapeRegExp(word));
	return new RegExp(`^${words.join('\\s*')}$`);
}

test.describe('Verify the Preferences', () => {
	const run = useSettingsTab(PreferencesTab);

	test('Open the Preferences tab and check its elements', async () => {
		await run.tab.open();
		await run.tab.expectElements();
	});

	for (const preference of preferences) {
		test(`Preference: ${preference.name}`, async () => {
			const toggle = run.tab.switchOf(preference.name);
			await expect(run.tab.text(preference.name).last()).toBeVisible();
			const description = run.tab.paragraph(asText(preference.description));
			await expect.soft(description.first(), `description of ${preference.name}`).toBeVisible();
			await expect(toggle).toBeAttached();
			await expect(run.tab.switchDrawnOver(toggle)).toBeVisible();
			test.info().annotations.push({ type: 'preference', description: `${preference.name} is ${(await toggle.isChecked()) ? 'on' : 'off'}` });
		});
	}

	test('Check the preference sections', async () => {
		for (const section of sections) {
			await expect.soft(run.tab.text(section.heading).first(), section.heading).toBeVisible();
			await expect.soft(run.tab.paragraph(asText(section.description)), section.heading).toBeVisible();
			for (const name of section.preferences) {
				await expect.soft(run.tab.switchOf(name), name).toBeAttached();
			}
		}
		// The deprecated preference is labelled as such.
		await expect(run.tab.text('Deprecated')).toBeVisible();
	});

	test('Check who can stop executions is explained', async () => {
		const explanation = run.tab.stopExplanation;
		for (const item of [
			'1.OFF [Default]',
			'2.ON',
			'a.Only Admins/Super Admins can "Stop" any executions via Usage Details or Run Results.',
			'b.Test Manager/Test Lead / Automation Engineer can view all executions but can "Stop" only executions or inspector sessions started by themselves.',
		]) {
			await expect.soft(explanation.getByRole('listitem').filter({ hasText: item }), item).toHaveText(item);
		}
	});

	test('Check the switches that cannot be used', async () => {
		// Plan-level accessibility testing is deprecated, so its switch is locked.
		await expect(run.tab.switchOf('Web Accessibility Testing - Plan level')).toBeDisabled();
		// Test Developers can only review their own work once Test Managers can review it.
		const reviewOn = (await run.tab.switchOf('Test Case Review Management').isChecked()) || (await run.tab.switchOf('Element Review Management').isChecked());
		test.info().annotations.push({ type: 'review management', description: reviewOn ? 'on' : 'off' });
		if (!reviewOn) {
			await expect(run.tab.switchOf('Self-Review Management')).toBeDisabled();
		}
	});

	test('Check the Copilot & Recorder Extension choices', async () => {
		await expect(run.tab.text('Copilot & Recorder Extension')).toBeVisible();
		await expect(run.tab.paragraph('Choose how the recorder extension is set up'))
			.toHaveText('Choose how the recorder extension is set up in the browser Testsigma launches for Copilot recording sessions.');
		let chosen = 0;
		for (const choice of recorderChoices) {
			const option = run.tab.recorderChoice(choice.name, choice.description);
			await expect.soft(option, choice.name).toBeAttached();
			if (await option.isChecked()) {
				chosen += 1;
				test.info().annotations.push({ type: 'recorder extension', description: choice.name });
			}
		}
		expect(chosen, 'recorder extension choices chosen').toBe(1);
	});
});
