/**
 * What the Admin Settings specs share: signing in with the news prompt kept out of the way, opening Settings and
 * its tabs, and each tab's elements, checked by the all-tabs spec and by each tab's own spec.
 */
import { expect, type Browser, type Locator, type Page } from '@playwright/test';
import { signInToTestsigma } from './testsigma-auth';

// Each tab is given this long after it opens so everything it loads is shown before it is checked.
export const settleTime = 6000;

// What a tab shows. Every text is matched exactly, and where the same text appears more than once, such as a
// tab's title and its name in the tab list, the last one on the page is checked.
export type SettingsTab = {
	name: string;
	path: string;
	// The title the tab's page shows, when it is not the tab's name.
	title?: string | RegExp;
	texts?: (string | RegExp)[];
	buttons?: (string | RegExp)[];
	links?: string[];
	textboxes?: string[];
	checkboxes?: string[];
	radios?: string[];
	headings?: string[];
	images?: string[];
	// The tab shows a table of what the account holds.
	table?: boolean;
	// Checks for what can take different forms, such as a table that may be empty.
	extra?: (main: Locator) => Promise<void>;
};

// Every integration, in the order the page lists them.
export const integrations: (string | RegExp)[] = [
	'Figma', /^Test Management\s*by\s*Testsigma$/, 'Xray Cloud', 'Xray Server / Data Center', 'Jira Cloud',
	'Jira Server / Data Center', 'Confluence Cloud', 'Confluence Server / Data Center', 'Monday.com', 'YouTrack',
	'Mantis Bug Tracker', 'Azure DevOps Boards', 'Backlog', 'Bugzilla', 'Trello', 'BrowserStack', 'Sauce Labs',
	'MS Teams', 'Slack', 'LambdaTest', 'Google Chat', 'Linear', 'ClickUp', 'Azure DevOps', 'CircleCI', 'Bamboo',
	'Amazon Web Services', 'TravisCI', 'Jenkins', 'CodeShip CI', 'Custom', 'Private Grid', 'TestRail', 'qTest',
	'GitHub', 'GitHub CI/CD', 'Zephyr Cloud', 'GitLab CI/CD', 'GitLab',
];

export const preferences = [
	'Auto Healing', 'Control Who can Stop Executions', 'Design Visual Validations', 'Test Case Review Management',
	'Element Review Management', 'Self-Review Management', 'Highlight element in screenshot', 'Screenshot with timestamp',
	'Test case level multi driver session', 'Detailed accessibility report', 'Use asset proxy', 'Use CDN signed URLs',
	'Web Accessibility Testing - Plan level', 'Web Accessibility Testing - Step level', 'Generative AI features',
	'Generative AI Autoheal', 'Agentic AI', 'Autonomous Testing', 'Generator (Live App)', 'Analyzer & Bug Reporter',
];

export const roleEntities = [
	'Projects', 'Applications', 'Versions', 'Requirements', 'Test Cases', 'Test Steps', 'Requirement Types',
	'Test Case Types', 'Test Data Profiles', 'Test Case Priorities', 'Elements', 'Application Types', 'Executions',
	'Test Machines', 'Test Suites', 'Schedules', 'Local Devices', 'User Management', 'Uploads', 'NLPs', 'Roles',
	'Results', 'Testcase Group Report', 'Custom Functions', 'Environments', 'Custom Fields', 'Plugins',
];

export const genAiFeatures = ['Copilot in Web/Mobile Recorder', 'Test Data Generation', 'API testing', 'Auto Heal', 'Visual Analysis', 'AI in Addons'];

export const tabs: SettingsTab[] = [
	{
		name: 'Integrations',
		path: 'plugs',
		texts: [
			'All Integrations', 'Bug Reporting', 'Collaboration', 'Test Lab', 'Test Management', 'Product Management', 'CICD',
			...integrations,
		],
		extra: async (main) => {
			// Every integration has a description and a "Learn more" link.
			await expect.soft(main.getByRole('link', { name: 'Learn more' })).toHaveCount(integrations.length);
		},
	},
	{
		name: 'API Keys',
		path: 'keys',
		texts: ['State', 'Key Name', 'Expiration', /^Parallel Allocation \(\d+\)$/],
		buttons: ['Generate new API Key'],
		table: true,
	},
	{
		name: 'Gen AI Keys',
		path: 'genai-keys',
		texts: [
			'Keys', 'Create new key', 'Integrate your preferred LLMs using your own API keys.', 'Feature Model Configuration',
			'Feature', 'Key', 'Model', ...genAiFeatures,
		],
		extra: async (main) => {
			await expect.soft(main.getByRole('note')).toContainText('BYOK configuration is pending');
			// Each feature has a key and a model to choose.
			await expect.soft(main.getByText('Select Model', { exact: true })).toHaveCount(genAiFeatures.length);
		},
	},
	{
		name: 'Preferences',
		path: 'preferences',
		texts: ['Review Management', 'Web Accessibility Testing', 'Deprecated', 'Copilot & Recorder Extension'],
		checkboxes: preferences,
		radios: ['Automatic (default)', 'Managed profile', 'Your own browser profile'],
	},
	{
		name: 'Labels',
		path: 'labels',
		texts: [/^All \(\d+\)$/, 'Saved Filters', 'Sort by', 'Label Name', 'Linked Entities'],
		buttons: ['Add New Label'],
		textboxes: ['Search'],
		checkboxes: ['Select All'],
		table: true,
	},
	{
		name: 'Exports',
		path: 'exports',
		texts: ['Report name', 'Initiated by', 'Project', 'Application', 'Status'],
		buttons: ['Refresh'],
		textboxes: ['Search'],
		table: true,
	},
	{
		name: 'Imports',
		path: 'imports',
		texts: ['Postman imports', 'Imported to', 'Imported from', 'Initiated by', 'Imported artefact', 'Status'],
		buttons: ['Import'],
		table: true,
	},
	{
		name: 'Phone Numbers (TFA)',
		path: 'phone_numbers',
		title: 'Phone numbers (Two-Factor Authentication)',
		// The introduction runs on into a "Click here" link, so it is matched by how it starts.
		texts: [/^Using Telephone Numbers in your Test Cases is simple\./],
		links: ['Click here'],
		extra: async (main) => {
			// Numbers are provisioned by Testsigma support, who can be reached from the empty state.
			const numbers = main.getByRole('grid');
			const noNumbers = main.getByText('There are no Phone Numbers', { exact: true });
			await expect(numbers.or(noNumbers).first()).toBeVisible();
			if (await noNumbers.isVisible()) {
				await expect(main.getByRole('img', { name: 'messageText illustration' })).toBeVisible();
				await expect(main.getByRole('link', { name: 'Chat', exact: true })).toBeVisible();
				await expect(main.getByRole('link', { name: 'support@testsigma.com' })).toHaveAttribute('href', /support@testsigma\.com/);
			}
		},
	},
	{
		name: 'Mail Boxes',
		path: 'mail_boxes',
		texts: [/^Using Mailbox emails in your Test Cases is simple\./],
		links: ['Click here'],
		table: true,
	},
	{
		name: 'Tunnels',
		path: 'connect_tunnels',
		headings: ['Tunnels'],
		texts: ['Sort by', 'Name', 'Tunnel Host Name', 'Client Host Name', 'Shared By', 'Owner', 'Version', 'State'],
		buttons: ['Refresh', 'What is a Tunnel?', 'Download Tunnel', 'All', 'Active', 'Inactive'],
		textboxes: ['Search'],
		table: true,
	},
	{
		name: 'Report Settings',
		path: 'customise_reports',
		texts: ['Customise Reports'],
		checkboxes: ['Customise Reports'],
		extra: async (main) => {
			await expect.soft(main.getByText(/^Export customised reports for your company by adding a logo/)).toBeVisible();
		},
	},
	{
		name: 'Audit Logs',
		path: 'audit_log',
		texts: ['Time', 'Event Type', 'Action', 'Project / App / Version', 'User', 'Details'],
		buttons: ['Export', 'Filters'],
		table: true,
	},
	{
		name: 'Users',
		path: 'users',
		// The title shares its element with the "Allowed Users" button beside it.
		title: /^Users\s*Allowed Users \(\d+\)$/,
		texts: [
			/^All \(\d+\)$/, /^Active users \(\d+\)$/, /^Invited users \(\d+\)$/, /^Inactive users \(\d+\)$/,
			/^Waitlisted users \(\d+\)$/, 'Pending requests', 'Sort by', 'Name', 'Status', 'Email', 'Parallel Allocation',
		],
		buttons: [/^Allowed Users \(\d+\)$/, 'Add new user'],
		textboxes: ['Search'],
		table: true,
	},
	{
		name: 'User Roles',
		path: 'roles',
		texts: ['Entities', 'Super Administrator', 'Test Manager', 'Test Lead', 'Automation Engineer/Developer', 'Read only'],
		table: true,
		extra: async (main) => {
			await expect.soft(main.getByText(/Account admin is the only person who has Full access/)).toBeVisible();
			// Every entity has a row giving each role's access to it.
			for (const entity of roleEntities) {
				await expect.soft(main.getByRole('row', { name: new RegExp(`^${entity}( (Full|Read only|No access)){5}$`) }), `${entity} row`).toBeVisible();
			}
		},
	},
	{
		name: 'Custom Fields',
		path: 'fields',
		// The count sits in an element of its own, right after "Test Case".
		texts: [/^Test Case\s*\(\d+\)$/, 'Field Name', 'Field Type'],
		buttons: ['Add new field'],
		table: true,
	},
	{
		name: 'iOS Settings',
		path: 'provisioning_profiles',
		texts: ['Provisioning Profile', 'Web Driver Agent', 'Create new profile', 'Profile Name', 'Apple Team ID', 'CSR', 'Created by', 'Expiry date'],
		textboxes: ['Search'],
		table: true,
	},
	{
		name: 'Manage Access',
		path: 'manage_access',
		texts: ['Account Login Access', 'Current Status'],
		extra: async (main) => {
			await expect.soft(main.getByText(/^To assist with support issues, our team may require access to your account\./)).toBeVisible();
			// Support access is either allowed or denied, with a button to change it.
			await expect.soft(main.getByText(/^Access (Denied|Allowed|Granted)$/)).toBeVisible();
			await expect.soft(main.getByRole('button', { name: /^(Allow|Revoke|Deny) Access$/ })).toBeVisible();
		},
	},
	{
		name: 'Certificates',
		path: 'certificates',
		buttons: ['Add certificate'],
		extra: async (main) => {
			const certificates = main.getByRole('grid');
			const noCertificates = main.getByText('No client certificates registered for this project yet.', { exact: true });
			await expect(certificates.or(noCertificates).first()).toBeVisible();
			if (await noCertificates.isVisible()) {
				await expect(main.getByRole('img', { name: 'Empty state illustration' })).toBeVisible();
			}
		},
	},
	{
		name: 'SMTP Configuration',
		path: 'smtp',
		texts: [
			'Testsigma', "Choose this option to receive emails on Testsigma's server",
			'Own', 'Configure SMTP to receive emails where you want them',
		],
		images: ['Testsigma logo'],
	},
	{
		name: 'Testsigma IP info',
		path: 'about',
		texts: ['Current Server Version', /^v\d+\.\d+\.\d+/, 'Testsigma Server IP', 'Testsigma Lab IP'],
		images: ['Testsigma-icon-with-name'],
		extra: async (main) => {
			await expect.soft(main.getByText(/^\d{1,3}(\.\d{1,3}){3}$/).first()).toBeVisible();
		},
	},
	{
		name: 'Plans & Billing',
		path: 'billing',
		title: 'Plans and Billing',
		texts: ['Billing details', 'For fast-growing teams', 'For TCOEs and multiple large teams'],
		headings: ['Billing history', 'Pro', 'Enterprise'],
		buttons: ['Edit details', 'Upto 25 parallels', 'For 25+ parallels', 'Contact Sales'],
		links: ['Chat', 'support@testsigma.com'],
	},
];

export function settingsTab(main: Locator, name: string) {
	return main.getByRole('button', { name, exact: true });
}

// A tab's page is headed by its title. Most titles repeat the tab's name, which the tab list already shows, so
// the title must appear once more than the tab list accounts for.
export async function expectTitle(main: Locator, tab: SettingsTab) {
	const title = tab.title ?? tab.name;
	const inTabList = tabs.some((other) => other.name === title) ? 1 : 0;
	const shown = textOf(main, title);
	await expect.poll(() => shown.count(), { message: `title ${title}`, timeout: 30000 }).toBeGreaterThan(inTabList);
	await expect(shown.last()).toBeVisible();
}

// Exact text, or a pattern for text with a number that changes.
export function textOf(main: Locator, text: string | RegExp) {
	return typeof text === 'string' ? main.getByText(text, { exact: true }) : main.getByText(text);
}

export function buttonOf(main: Locator, name: string | RegExp) {
	return typeof name === 'string' ? main.getByRole('button', { name, exact: true }) : main.getByRole('button', { name });
}

// Each element is checked on its own, so a run reports every element missing from a tab rather than only the first.
export async function expectTabElements(main: Locator, tab: SettingsTab) {
	for (const text of tab.texts ?? []) {
		await expect.soft(textOf(main, text).last(), `text ${text}`).toBeVisible();
	}
	for (const name of tab.buttons ?? []) {
		await expect.soft(buttonOf(main, name).last(), `button ${name}`).toBeVisible();
	}
	for (const name of tab.links ?? []) {
		await expect.soft(main.getByRole('link', { name, exact: true }).last(), `link ${name}`).toBeVisible();
	}
	for (const name of tab.textboxes ?? []) {
		await expect.soft(main.getByRole('textbox', { name, exact: true }).last(), `textbox ${name}`).toBeVisible();
	}
	for (const name of tab.checkboxes ?? []) {
		await expect.soft(main.getByRole('checkbox', { name, exact: true }).last(), `toggle ${name}`).toBeVisible();
	}
	for (const name of tab.radios ?? []) {
		await expect.soft(main.getByRole('radio', { name: new RegExp(`^${name.replace(/[()]/g, '\\$&')}`) }), `option ${name}`).toBeVisible();
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

// The news widget's prompt can cover the page at any time and cannot always be dismissed, so the widget is kept
// from loading at all.
async function blockNewsWidget(page: Page) {
	await page.route(/getbeamer\.com/, (route) => route.abort());
}

// Settings opens on its first tab, with the tab list beside it.
export async function openSettings(page: Page) {
	await page.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true }).click();
	await expect(page).toHaveURL(/\/ui\/settings\/plugs$/, { timeout: 30000 });
	await expect(page.locator('main').getByRole('heading', { name: 'Admin Settings', level: 1 })).toBeVisible({ timeout: 30000 });
}

// Opens a page of its own, signs in and opens Settings.
export async function openSignedInSettings(browser: Browser) {
	const page = await browser.newPage();
	page.setDefaultTimeout(15000);
	await blockNewsWidget(page);
	await signInToTestsigma(page);
	await openSettings(page);
	return page;
}

export function findTab(name: string) {
	const tab = tabs.find((item) => item.name === name);
	if (!tab) {
		throw new Error(`No Admin Settings tab named ${name}`);
	}
	return tab;
}

// Opens a tab from the tab list, checks its address and title, and gives it time to finish loading.
export async function openTab(page: Page, tab: SettingsTab) {
	const main = page.locator('main');
	await settingsTab(main, tab.name).click();
	await expect(page).toHaveURL(new RegExp(`/ui/settings/${tab.path}$`), { timeout: 30000 });
	await expectTitle(main, tab);
	await page.waitForTimeout(settleTime);
}

// Goes back to a tab afresh, as though opened from the tab list, leaving behind whatever an earlier check did.
export async function reopenTab(page: Page, tab: SettingsTab) {
	await page.goto(`settings/${tab.path}`);
	await expectTitle(page.locator('main'), tab);
	await page.waitForTimeout(settleTime);
}
