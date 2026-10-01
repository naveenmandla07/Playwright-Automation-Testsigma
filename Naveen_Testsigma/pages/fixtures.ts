/**
 * Playwright's test, given the page objects as fixtures: a test asks for the ones it uses by name, e.g.
 * `test('...', async ({ loginPage }) => { ... })`, and each is made for the test's own page.
 *
 * Specs whose tests share one signed-in page across a serial describe make their page objects in beforeAll instead,
 * since fixtures are made afresh for every test.
 */
import { test as base } from '@playwright/test';
import { SideNavigation } from './components/SideNavigation';
import { LoginPage } from './login/LoginPage';

type PageObjects = {
	loginPage: LoginPage;
	sideNavigation: SideNavigation;
};

export const test = base.extend<PageObjects>({
	loginPage: async ({ page }, use) => use(new LoginPage(page)),
	sideNavigation: async ({ page }, use) => use(new SideNavigation(page)),
});

export { expect } from '@playwright/test';
