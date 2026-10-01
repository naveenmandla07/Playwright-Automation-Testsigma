/**
 * What the Admin Settings specs share: signing in and opening Settings on a page of their own, and the set-up of a
 * spec for one tab, run on that tab's page object.
 */
import { expect, test, type Browser, type Page, type Request } from '@playwright/test';
import { SettingsPage, type SettingsTabPage } from '../pages/settings/SettingsPage';
import { missingCredentials, missingCredentialsMessage, signInToTestsigma } from './testsigma-auth';

// Opens a page of its own, signs in and opens Settings.
export async function openSignedInSettings(browser: Browser) {
	const page = await browser.newPage();
	page.setDefaultTimeout(15000);
	await signInToTestsigma(page);
	await new SettingsPage(page).openSettings();
	return page;
}

// What a tab's spec works with: the signed-in page and the tab's page object on it.
export type SettingsTabRun<Tab extends SettingsTabPage> = { page: Page; tab: Tab };

/**
 * Sets up a spec for one Admin Settings tab: its checks run in order on one signed-in page on that tab, but one
 * that fails does not stop the rest. Each check starts on the tab with no popup open, and fails if it sent any
 * change to Testsigma, since these specs only look and never save.
 */
export function useSettingsTab<Tab extends SettingsTabPage>(TabPage: new (page: Page) => Tab): SettingsTabRun<Tab> {
	const run = {} as SettingsTabRun<Tab>;
	const changes: string[] = [];
	const recordChange = (request: Request) => {
		const url = new URL(request.url());
		if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && url.hostname === 'app.testsigma.com') {
			changes.push(`${request.method()} ${url.pathname}`);
		}
	};

	test.describe.configure({ mode: 'default', timeout: 120000 });
	test.skip(missingCredentials, missingCredentialsMessage);

	test.beforeAll(async ({ browser }) => {
		// Signing in, opening Settings and letting the tab settle can take longer than a hook's own 30 seconds.
		test.setTimeout(120000);
		run.page = await openSignedInSettings(browser);
		run.tab = new TabPage(run.page);
		run.page.on('request', recordChange);
		await run.tab.open();
	});

	test.afterAll(async () => {
		await run.page.close();
	});

	test.beforeEach(async () => {
		changes.length = 0;
		// A check that failed may have left a popup open. Some popups ignore Escape, and those are left behind by
		// loading the tab afresh.
		if (await run.tab.dialog.count()) {
			await run.page.keyboard.press('Escape');
		}
		const popupLeft = await run.tab.dialog.count() > 0;
		// A check that failed may also have left the tab, and after a failure the checks go on in a new page.
		if (popupLeft || !run.tab.isOpen()) {
			await run.tab.reopen();
		}
		await expect(run.tab.dialog).toHaveCount(0);
	});

	test.afterEach(async () => {
		expect(changes, 'changes sent to Testsigma').toEqual([]);
	});

	return run;
}
