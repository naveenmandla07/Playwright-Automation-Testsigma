/**
 * The Integrations tab of Admin Settings: its category tabs and every integration on it.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Integrations tab and check its elements.
 * - Scroll to the end of the list and check all 39 integrations are there.
 * - Open each category tab, from "All Integrations" to "CICD", and check it lists exactly its integrations.
 * - Check each integration: its logo, name, description, "Learn more" link and switch, then:
 *   - when it is switched on, open "Manage" and check the details popup, then close it;
 *   - when it is switched off, switch it on and check the popup that asks for its details, then cancel it;
 *   - when its switch cannot be used, or it has none, check that.
 *
 * Test Management by Testsigma shows, in place of a switch, an icon saying it waits for a user invitation.
 *
 * Nothing is saved: a switched-off integration only turns on once its details are saved, which this never does, so
 * every popup is cancelled or closed, and each check confirms the switch is back where it started and that no
 * change was sent to Testsigma. "Delete credentials" and "Update details" are checked but never clicked. Saved
 * details are checked to be filled in, not for their values, since they belong to the account.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectTabElements, openTab, useSettingsTab } from '../../support/admin-settings';
import { escapeRegExp } from '../../support/common';

// What a popup shows: its heading, its fields and buttons, and anything else on it.
type Popup = {
	heading: string;
	fields?: string[];
	buttons: string[];
	links?: string[];
	texts?: RegExp[];
	radios?: string[];
	// A search box over a list of saved details.
	search?: boolean;
	// The fields cannot be typed in until another integration is set up.
	fieldsDisabled?: boolean;
};

type Integration = {
	name: string;
	// Where the name cannot be matched exactly, such as a name split over two lines.
	match?: RegExp;
	// How the card's description starts.
	description: string;
	docs: string;
	// A card either has a switch, has one that cannot be used, or has none and only links to its documentation.
	switch: 'usable' | 'unusable' | 'none';
	// The popup for adding its details, shown when it is switched on.
	setup?: Popup;
	// The popup shown by "Manage" once it is set up.
	manage?: Popup;
	// What the integration is waiting for, shown on hovering the icon in place of its switch.
	pending?: string;
};

const categories = ['All Integrations', 'Bug Reporting', 'Collaboration', 'Test Lab', 'Test Management', 'Product Management', 'CICD'];

const docs = 'https://testsigma.com/docs';

// A popup asking for an integration's details before it can be switched on.
function detailsForm(name: string, fields: string[], extra: Partial<Popup> = {}): Popup {
	return { heading: `${name} details`, fields, buttons: ['Save & Enable', 'Cancel'], ...extra };
}

// A popup that sends the user to the integration's own site to sign in, with a way to use an API key instead.
function signInElsewhere(name: string, extra: Partial<Popup> = {}): Popup {
	return {
		heading: `Connect ${name}`,
		buttons: ['Use an API key', 'Cancel', `Continue with ${name}`],
		texts: [new RegExp(`^You will be sent to ${name} to authorise Testsigma\\. Nothing is typed here`)],
		...extra,
	};
}

// The popup "Manage" opens for an integration that is set up, showing its saved details.
function savedDetails(name: string, fields: string[], extra: Partial<Popup> = {}): Popup {
	return { heading: `${name} details`, fields, buttons: ['Update details', 'Delete credentials'], ...extra };
}

const apiKeyFields = ['User Name', 'API Key', 'Confirm API Key'];
const chatFields = ['Name', 'Connector URL'];

const integrations: Integration[] = [
	{
		name: 'Figma',
		description: 'Integrate Figma with Testsigma to seamlessly bring your designs into the testing workflow.',
		docs: `${docs}/integrations/product-management/figma/`,
		switch: 'usable',
		// Figma lists its saved teams, each with its Team ID and API Key.
		manage: { heading: 'Figma details', buttons: ['Add'], search: true, texts: [/^Team ID$/, /^API Key$/] },
	},
	{
		name: 'Test Management by Testsigma',
		match: /^Test Management\s*by Testsigma$/,
		description: 'Enable your team to link Testsigma test Cases with Testsigma’s Test Management System',
		docs: `${docs}/test-management/testsigma-two-way-integration/connect-testsigma/`,
		switch: 'none',
		pending: 'Pending User Invitation',
	},
	{
		name: 'Xray Cloud',
		// The card repeats the Azure DevOps Boards description.
		description: 'Enable your team to report a bug on Azure DevOps Boards, track status and rerun on closure',
		docs: `${docs}/integrations/test-management/xray/`,
		switch: 'usable',
		manage: savedDetails('Xray Cloud', ['Jira Account URL', 'Client Id', 'Client Secret'], { links: ['Get Xray Credentials'] }),
	},
	{
		name: 'Xray Server / Data Center',
		description: 'Enable your team to link Testsigma Test Cases with on-premise Jira Xray Server and push ex',
		docs: `${docs}/integrations/test-management/xray-server/`,
		switch: 'usable',
		setup: detailsForm('Xray Server / Data Center', ['Xray Server URL', 'Username / Email', 'Personal Access Token'], {
			fieldsDisabled: true,
			texts: [/Please configure Jira Server integration and return to this screen\./],
		}),
	},
	{
		name: 'Jira Cloud',
		description: 'Enable your team to stay connected to your favorite Atlassian Jira Product, to raise bugs,',
		docs: `${docs}/integrations/bug-reporting/jira/`,
		switch: 'usable',
		manage: savedDetails('Jira Cloud', ['Account URL', 'User Name', 'API Key', 'Confirm API Key'], {
			buttons: ['Connect with Atlassian instead', 'Update details', 'Delete credentials'],
		}),
	},
	{
		name: 'Jira Server / Data Center',
		description: 'Enable your team to stay connected to your on-premise Jira Server. Generate test cases fro',
		docs: `${docs}/integrations/bug-reporting/jira-server/`,
		switch: 'usable',
		setup: detailsForm('Jira Server / Data Center', ['Server URL', 'Username / Email', 'Personal Access Token', 'Confirm Personal Access Token']),
	},
	{
		name: 'Confluence Cloud',
		description: 'Connect your Atlassian Confluence Cloud to use wiki pages as context for AI-powered test g',
		docs: `${docs}/integrations/product-management/confluence/`,
		switch: 'usable',
		setup: signInElsewhere('Confluence Cloud'),
	},
	{
		name: 'Confluence Server / Data Center',
		description: 'Connect your on-premise Confluence Server to use wiki pages as context for AI-powered test',
		docs: `${docs}/integrations/product-management/confluence/`,
		switch: 'usable',
		setup: detailsForm('Confluence Server / Data Center', ['Confluence Server URL', 'Username', 'API Token / Password']),
	},
	{
		name: 'Monday.com',
		description: 'Enable your team to stay connected to on Monday.com Product, to raise bugs, check status a',
		docs: `${docs}/integrations/bug-reporting/monday.com/`,
		switch: 'usable',
		setup: signInElsewhere('monday.com', {
			links: ['Install the Testsigma app on monday.com'],
			texts: [
				/^monday\.com will not authorise an account that does not have the Testsigma app installed\./,
				/^You will be sent to monday\.com to authorise Testsigma\. Nothing is typed here/,
			],
		}),
	},
	{
		name: 'YouTrack',
		description: 'Enable your team to report a bug on YouTrack, track status and rerun on closure of bug wit',
		docs: `${docs}/integrations/bug-reporting/youtrack/`,
		switch: 'usable',
		setup: detailsForm('YouTrack', ['Organization URL', 'Access Key']),
	},
	{
		name: 'Mantis Bug Tracker',
		description: 'Enable your team to report a bug on Mantis Bug Tracker, track status and rerun on closure',
		docs: `${docs}/integrations/bug-reporting/mantis/`,
		switch: 'usable',
		setup: detailsForm('Mantis Bug Tracker', ['Account URL', 'API Key']),
	},
	{
		name: 'Azure DevOps Boards',
		description: 'Enable your team to report a bug on Azure DevOps Boards, track status and rerun on closure',
		docs: `${docs}/integrations/test-management/azure-devops-boards/`,
		switch: 'unusable',
	},
	{
		name: 'Backlog',
		description: 'Enable your team to report a bug on Backlog, track status and rerun on closure of bug with',
		docs: `${docs}/integrations/bug-reporting/backlog/`,
		switch: 'usable',
		setup: detailsForm('Backlog', ['Account URL', 'API Key']),
	},
	{
		name: 'Bugzilla',
		description: 'Enable your team to report a bug on BugZilla, track status and rerun on closure of bug wit',
		docs: `${docs}/integrations/bug-reporting/bugzilla/`,
		switch: 'usable',
		setup: detailsForm('Bugzilla', ['Account URL', 'API Key']),
	},
	{
		name: 'Trello',
		description: 'Enable your team to report a bug on Trello, track status and rerun on closure of bug witho',
		docs: `${docs}/integrations/test-management/trello/`,
		switch: 'usable',
		setup: detailsForm('Trello', ['API Key', 'Token']),
	},
	{
		name: 'BrowserStack',
		description: 'Connect to your BrowserStack account as your test lab on cloud.',
		docs: `${docs}/integrations/test-labs/browserstack/`,
		switch: 'usable',
		manage: savedDetails('BrowserStack', apiKeyFields),
	},
	{
		name: 'Sauce Labs',
		description: 'Connect to your Sauce Labs account as your test lab on cloud.',
		docs: `${docs}/integrations/test-labs/sauce-labs/`,
		switch: 'usable',
		manage: savedDetails('Sauce Labs', apiKeyFields),
	},
	{
		name: 'MS Teams',
		description: 'Connect to Microsoft Teams to get notifications for your run instantly.',
		docs: `${docs}/integrations/collaboration/microsoft-teams/`,
		switch: 'usable',
		setup: detailsForm('MS Teams', chatFields),
	},
	{
		name: 'Slack',
		description: 'Connect to Slack to get notifications for your run instantly.',
		docs: `${docs}/integrations/collaboration/slack/`,
		switch: 'usable',
		setup: detailsForm('Slack', ['Name', 'Webhook URL', 'Post to channel (Optional)', 'Username that this integration is posted as (Optional)']),
	},
	{
		name: 'LambdaTest',
		description: 'Connect to your Lambda Test account as your test lab on cloud.',
		docs: `${docs}/integrations/test-labs/lambdatest/`,
		switch: 'usable',
		manage: savedDetails('LambdaTest', apiKeyFields),
	},
	{
		name: 'Google Chat',
		description: 'Connect to Google Chat to get notifications for your run instantly.',
		docs: `${docs}/integrations/collaboration/google-chat/`,
		switch: 'usable',
		setup: detailsForm('Google Chat', chatFields),
	},
	{
		name: 'Linear',
		description: 'Enable your team to report a bug on Linear, track status and rerun on closure of bug witho',
		docs: `${docs}/integrations/test-management/linear/`,
		switch: 'usable',
		setup: signInElsewhere('Linear'),
	},
	{
		name: 'ClickUp',
		description: 'Enable your team to report a bug on ClickUp, track status and rerun on closure of bug with',
		docs: `${docs}/integrations/test-management/clickup/`,
		switch: 'usable',
		setup: signInElsewhere('ClickUp'),
	},
	{
		name: 'Azure DevOps',
		description: 'Azure DevOps has robust integrations with Azure and a comprehensive suite of technologies',
		docs: `${docs}/continuous-integration/azure-devops/`,
		switch: 'none',
	},
	{
		name: 'CircleCI',
		description: 'CircleCI allows teams to rapidly release code they trust by automating the build, test, an',
		docs: `${docs}/continuous-integration/circle-ci/`,
		switch: 'none',
	},
	{
		name: 'Bamboo',
		description: 'By integrating Testsigma application with Bamboo, you can seamlessly view and monitor the',
		docs: `${docs}/continuous-integration/bamboo-ci/`,
		switch: 'none',
	},
	{
		name: 'Amazon Web Services',
		description: 'Utilise the power of AWS Cloud by integrating your Testsigma application with Amazon Web S',
		docs: `${docs}/continuous-integration/aws-devops/`,
		switch: 'none',
	},
	{
		name: 'TravisCI',
		description: 'Travis CI enables your team to test and ship your apps with confidence. Easily sync your T',
		docs: `${docs}/continuous-integration/travis-ci/`,
		switch: 'none',
	},
	{
		name: 'Jenkins',
		description: 'Integration of Jenkins with Testsigma helps you to run your scripts whenever there is a ch',
		docs: `${docs}/continuous-integration/jenkins/`,
		switch: 'none',
	},
	{
		name: 'CodeShip CI',
		description: 'Codeship helps to release software quickly, automatically and multiple times a day. It int',
		docs: `${docs}/continuous-integration/codeship-ci/`,
		switch: 'none',
	},
	{
		name: 'Custom',
		description: 'Use robust RESTful APIs from Testsigma to develop custom plugins.',
		docs: `${docs}/continuous-integration/shell-script/`,
		switch: 'none',
	},
	{
		name: 'Private Grid',
		description: 'Flexible and robust testing infrastructure solution. Empower your team to better manage re',
		docs: `${docs}/runs/executing-tests-in-private-grid/`,
		switch: 'none',
	},
	{
		name: 'TestRail',
		description: 'Enable your team to link TestRail Test Cases with Testsigma, sync execution results in you',
		docs: `${docs}/integrations/test-management/testrail/`,
		switch: 'usable',
		setup: detailsForm('TestRail', ['Host URL', 'Username', 'API Key']),
	},
	{
		name: 'qTest',
		description: 'Enable your team to link qTest Test Cases with Testsigma, sync execution results in your q',
		docs: `${docs}/integrations/test-management/qtest/`,
		switch: 'usable',
		setup: detailsForm('qTest', ['Host URL', 'Bearer Token']),
	},
	{
		name: 'GitHub',
		description: 'Connect GitHub with Testsigma to gain visibility into PRs, Jira Stories, Figma Designs, et',
		docs: `${docs}/continuous-integration/github-cicd/`,
		switch: 'usable',
		setup: signInElsewhere('GitHub'),
	},
	{
		name: 'GitHub CI/CD',
		description: 'Connect GitHub with Testsigma to enable automated testing workflows, quality gate tests, a',
		docs: `${docs}/continuous-integration/github-cicd/`,
		switch: 'none',
	},
	{
		name: 'Zephyr Cloud',
		description: 'Enable your team to link Zephyr Test Cases with Testsigma, sync execution results in your',
		docs: `${docs}/integrations/test-management/zephyr/`,
		switch: 'usable',
		manage: savedDetails('Zephyr Cloud', ['Personal Access Token', 'Account URL', 'User Name', 'API Key'], {
			links: ['Get Zephyr Credentials', 'Get Jira Credentials'],
			radios: ['US', 'EU'],
			texts: [/^Region of your Zephyr instance/],
		}),
	},
	{
		name: 'GitLab CI/CD',
		description: 'Connect GitLab with Testsigma to enable automated testing workflows, quality gate tests, a',
		docs: `${docs}/continuous-integration/gitlab-cicd/`,
		switch: 'none',
	},
	{
		name: 'GitLab',
		description: 'Enable your team to report a bug on GitLab, track status and rerun on closure of bug witho',
		docs: `${docs}/integrations/bug-reporting/gitlab/`,
		switch: 'usable',
		manage: savedDetails('GitLab', ['Personal Access Token', 'Confirm Personal Access Token'], {
			buttons: ['Connect with GitLab instead', 'Update details', 'Delete credentials'],
		}),
	},
];

// The integrations each category tab lists, in order.
const categoryIntegrations: Record<string, string[]> = {
	'All Integrations': integrations.map((integration) => integration.name),
	'Bug Reporting': [
		'Jira Cloud', 'Jira Server / Data Center', 'Monday.com', 'YouTrack', 'Mantis Bug Tracker', 'Backlog', 'Bugzilla',
		'Trello', 'Linear', 'ClickUp', 'qTest', 'GitHub', 'GitLab',
	],
	Collaboration: ['MS Teams', 'Slack', 'Google Chat'],
	'Test Lab': ['BrowserStack', 'Sauce Labs', 'LambdaTest', 'Private Grid'],
	'Test Management': ['Test Management by Testsigma', 'Xray Cloud', 'Xray Server / Data Center', 'Azure DevOps Boards', 'TestRail', 'qTest', 'Zephyr Cloud'],
	'Product Management': ['Figma', 'Confluence Cloud', 'Confluence Server / Data Center', 'Trello', 'Linear', 'ClickUp'],
	CICD: ['Azure DevOps', 'CircleCI', 'Bamboo', 'Amazon Web Services', 'TravisCI', 'Jenkins', 'CodeShip CI', 'GitHub CI/CD', 'GitLab CI/CD'],
};

function nameOf(main: Locator, integration: Integration) {
	return integration.match ? main.getByText(integration.match) : main.getByText(integration.name, { exact: true });
}

// An integration's card holds its logo, name, description, "Learn more" link and switch.
function cardOf(main: Locator, integration: Integration) {
	return nameOf(main, integration).first().locator("xpath=ancestor::div[.//a[normalize-space()='Learn more']][1]");
}

// The switch's checkbox is only there for screen readers; the switch drawn beside it is what takes the click.
function switchOf(card: Locator) {
	return card.getByRole('checkbox');
}

// The names of the integrations the page is showing, in order, with line breaks inside a name read as spaces.
async function shownIntegrations(page: Page) {
	return page.evaluate(() =>
		[...document.querySelectorAll('main img[alt="logo"]')]
			.filter((logo) => (logo as HTMLElement).offsetParent !== null)
			.map((logo) => ((logo.nextElementSibling as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ').trim()),
	);
}

async function expectPopup(popup: Locator, expected: Popup, saved: boolean) {
	await expect(popup.getByRole('heading', { name: expected.heading, exact: true })).toBeVisible();
	for (const field of expected.fields ?? []) {
		const box = popup.getByRole('textbox', { name: field, exact: true });
		await expect.soft(box, `field ${field}`).toBeVisible();
		if (saved) {
			// Saved details are shown, with secrets masked.
			await expect.soft(box, `saved ${field}`).not.toHaveValue('');
		} else if (expected.fieldsDisabled) {
			await expect.soft(box, `field ${field}`).toBeDisabled();
		} else {
			await expect.soft(box, `field ${field}`).toBeEmpty();
			await expect.soft(box, `field ${field}`).toBeEditable();
		}
	}
	for (const name of expected.buttons) {
		await expect.soft(popup.getByRole('button', { name, exact: true }), `button ${name}`).toBeVisible();
	}
	// Nothing can be saved until details are entered or changed.
	for (const name of ['Save & Enable', 'Update details']) {
		if (expected.buttons.includes(name)) {
			await expect.soft(popup.getByRole('button', { name, exact: true }), `button ${name}`).toBeDisabled();
		}
	}
	for (const name of expected.links ?? []) {
		await expect.soft(popup.getByRole('link', { name, exact: true }), `link ${name}`).toBeVisible();
	}
	for (const text of expected.texts ?? []) {
		await expect.soft(popup.getByText(text).first(), `text ${text}`).toBeVisible();
	}
	if (expected.search) {
		await expect.soft(popup.getByRole('textbox', { name: 'Search', exact: true }), 'search').toBeVisible();
	}
	for (const name of expected.radios ?? []) {
		await expect.soft(popup.getByRole('radio', { name, exact: true }), `option ${name}`).toBeAttached();
	}
}

test.describe('Verify all the integrations', () => {
	const run = useSettingsTab('Integrations');

	test('Open the Integrations tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
	});

	test('Scroll to the end of the list', async () => {
		await run.main.getByText('All Integrations', { exact: true }).click();
		const last = cardOf(run.main, integrations[integrations.length - 1]);
		await last.scrollIntoViewIfNeeded();
		await expect(last).toBeInViewport();
		await expect(run.main.getByRole('link', { name: 'Learn more' }).last()).toBeInViewport();
		expect(await shownIntegrations(run.page)).toEqual(categoryIntegrations['All Integrations']);
		await run.main.getByText('All Integrations', { exact: true }).scrollIntoViewIfNeeded();
	});

	for (const category of categories) {
		test(`Category tab: ${category}`, async () => {
			await run.main.getByText(category, { exact: true }).first().click();
			const expected = categoryIntegrations[category];
			await expect.poll(() => shownIntegrations(run.page), { message: `integrations under ${category}` }).toEqual(expected);
			await expect(run.main.getByRole('link', { name: 'Learn more' }).filter({ visible: true })).toHaveCount(expected.length);
			await run.main.getByText('All Integrations', { exact: true }).click();
			await expect.poll(() => shownIntegrations(run.page)).toHaveLength(integrations.length);
		});
	}

	for (const integration of integrations) {
		test(`Integration: ${integration.name}`, async () => {
			const card = cardOf(run.main, integration);
			await card.scrollIntoViewIfNeeded();
			await expect(card.getByRole('img', { name: 'logo' })).toBeVisible();
			await expect(nameOf(run.main, integration).first()).toBeVisible();
			await expect.soft(card.getByText(new RegExp(`^${escapeRegExp(integration.description)}`))).toBeVisible();
			await expect.soft(card.getByRole('link', { name: 'Learn more' })).toHaveAttribute('href', integration.docs);

			const manage = card.getByRole('button', { name: 'Manage', exact: true });
			if (integration.pending) {
				// In place of a switch, an icon says what the integration is waiting for.
				await card.locator('svg').last().hover();
				await expect.soft(run.page.getByRole('tooltip', { name: integration.pending }).first()).toBeVisible();
			}
			if (integration.switch === 'none') {
				await expect(switchOf(card)).toHaveCount(0);
				await expect(manage).toHaveCount(0);
				return;
			}
			if (integration.switch === 'unusable') {
				await expect(switchOf(card)).toBeDisabled();
				await expect(switchOf(card)).not.toBeChecked();
				await expect(manage).toHaveCount(0);
				return;
			}

			const popup = run.page.getByRole('dialog');
			const isOn = await switchOf(card).isChecked();
			test.info().annotations.push({ type: 'switch', description: `${integration.name} is switched ${isOn ? 'on' : 'off'}` });
			if (isOn) {
				// Switched on: "Manage" shows the saved details. Close them without changing anything.
				await expect(manage).toBeVisible();
				await manage.click();
				const expected = integration.manage ?? savedDetails(integration.name, []);
				await expectPopup(popup, expected, true);
				await run.page.keyboard.press('Escape');
				await expect(popup).toHaveCount(0);
				await expect(switchOf(card)).toBeChecked();
			} else {
				// Switched off: switching it on asks for its details. Cancel without saving, which leaves it off.
				await expect(manage).toHaveCount(0);
				await switchOf(card).locator('..').getByTestId('toggle-switch').click();
				const expected = integration.setup ?? detailsForm(integration.name, []);
				await expectPopup(popup, expected, false);
				await popup.getByRole('button', { name: 'Cancel', exact: true }).click();
				await expect(popup).toHaveCount(0);
				await expect(switchOf(card)).not.toBeChecked();
			}
		});
	}
});
