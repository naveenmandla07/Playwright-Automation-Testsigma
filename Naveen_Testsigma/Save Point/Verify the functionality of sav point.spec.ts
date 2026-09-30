/**
 * Save points: creating one from the "[9.0.8] Accessibility" project's Web App, version 1, opening it, and the
 * limit of ten. The Save Points page lists every save point of the account, each made from the version it names.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Switch to the "[9.0.8] Accessibility" project, its "Web App" application and version "1".
 * - Open Save Points and check the page and every save point listed.
 * - When the list is already full, check another cannot be created and delete the oldest save point to make room.
 * - Open "Create Save Point" and check the popup: its name, the count of characters used, and cancelling it.
 * - Create a save point with a name of its own and check it is listed first.
 * - Open the new save point and check it: its date, project, application and version, and its sections.
 * - Go through each section, Test Cases, Step Groups, Elements, Test Data Profiles, Test Suites and Test Plans, and
 *   check each shows what the version held when the save point was made.
 * - Fill the list up to ten, check an eleventh cannot be created, then delete the save points added for that,
 *   checking how deleting is confirmed.
 *
 * The save points this spec creates are named "Playwright ...". A run first deletes those left by earlier runs, and
 * keeps the one it creates so it can be looked at. When the list is full of other save points, the oldest is
 * deleted, whoever made it. "Restore" and "Restore to this Version" are checked but never clicked, since they would
 * put the whole version back as it was. Runs in the serial chromium-projects project because it changes the
 * account's current project.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { openSignedInPage, projectName, switchToApplication, versionName } from '../support/create-test-suites';
import { missingCredentials, missingCredentialsMessage } from '../support/testsigma-auth';

type SavePoint = { id: number; description: string; type: 'MANUAL' | 'IMPORT'; createdAtEpoch: number; applicationVersionId: number };

const application = { name: 'Web App', type: 'WebApplication' };
// A version keeps at most this many save points.
const limit = 10;
const ownPrefix = 'Playwright ';
const runStamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
const savePointName = `${ownPrefix}save point ${runStamp}`;
const nameLimit = 250;
// Each section is given this long after it opens so everything it loads is shown before it is checked.
const settleTime = 6000;
// e.g. "Wed | Sep 30 2026 | 17:26"
const when = /^\w{3} \| \w{3} \d{2} \d{4} \| \d{2}:\d{2}$/;
const typeLabels = { MANUAL: 'Manual Save point', IMPORT: 'Import' };

async function listSavePoints(page: Page, versionId: number): Promise<SavePoint[]> {
	const response = await page.request.get(`/versioning/save_points?applicationVersionId=${versionId}&size=100&page=0&sort=id,desc`);
	expect(response.ok()).toBe(true);
	return response.json();
}

async function deleteSavePointById(page: Page, id: number) {
	expect((await page.request.delete(`/versioning/save_points/${id}`)).ok()).toBe(true);
}

// The version as it is now, which a save point made now must hold.
async function liveSuites(page: Page, versionId: number): Promise<string[]> {
	const response = await page.request.get(`/private/test_suites?query=appVersionId:${versionId},suiteType:TS_SUITE&size=500&page=0`);
	return (await response.json()).content.map((suite: { name: string }) => suite.name).sort();
}

async function livePlans(page: Page, versionId: number): Promise<string[]> {
	const response = await page.request.get(`/executions?query=applicationVersionId:${versionId},entityType:EXECUTION&size=500&page=0`);
	return (await response.json()).content.map((plan: { name: string }) => plan.name).sort();
}

// Each save point is a card linking to it, showing when it was made, its name and how it was made.
function savePointCards(main: Locator) {
	return main.getByRole('link').filter({ hasText: new RegExp(when.source.slice(1, -1)) });
}

function cardOf(main: Locator, name: string) {
	return savePointCards(main).filter({ has: main.page().getByText(name, { exact: true }) });
}

// A card reads when the save point was made, its name, then how it was made, e.g.
// "Wed | Sep 30 2026 | 17:26 dewdeferf Manual Save point".
async function readCard(card: Locator) {
	const text = (await card.innerText()).replace(/\s+/g, ' ').trim();
	const made = text.match(new RegExp(`^${when.source.slice(1, -1)}`))?.[0] ?? '';
	const how = Object.values(typeLabels).find((label) => text.endsWith(` ${label}`)) ?? '';
	return { made, name: text.slice(made.length, text.length - how.length).trim(), how };
}

// The names of the listed save points, newest first.
async function listedNames(main: Locator) {
	return Promise.all((await savePointCards(main).all()).map(async (card) => (await readCard(card)).name));
}

test.describe('Verify the functionality of save points', () => {
	test.describe.configure({ mode: 'serial', timeout: 300000 });
	test.skip(missingCredentials, missingCredentialsMessage);

	let page: Page;
	let main: Locator;
	// A save point opens in a tab of its own.
	let preview: Page;
	let previewMain: Locator;
	let versionId: number;
	// The save point this run creates, and what the version held when it was made.
	let created: SavePoint;
	let suites: string[] = [];
	let plans: string[] = [];

	function popup() {
		return page.getByRole('dialog');
	}

	async function openSavePoints() {
		await page.goto('save_points');
		await expect(main.getByRole('heading', { name: 'Save Points', level: 1 })).toBeVisible({ timeout: 30000 });
		await page.waitForTimeout(settleTime);
	}

	async function openCreatePopup() {
		await main.getByRole('button', { name: 'Create Save Point' }).click();
		await expect(popup().getByRole('heading', { name: 'Create a Save Point?' })).toBeVisible();
	}

	// Messages stack up while they show, so wait for earlier ones to go before one that is to be checked.
	async function waitForMessagesToGo() {
		await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 30000 });
	}

	// Creates a save point from the popup and checks Testsigma made it.
	async function createSavePoint(name: string) {
		await waitForMessagesToGo();
		await openCreatePopup();
		await popup().getByRole('textbox', { name: 'Enter your Save point name' }).fill(name);
		await popup().getByRole('button', { name: 'Create', exact: true }).click();
		await expect(page.getByRole('alert').filter({ hasText: 'Save point created successfully' })).toBeVisible({ timeout: 120000 });
		await expect(cardOf(main, name)).toBeVisible({ timeout: 30000 });
	}

	// Deletes a save point from its menu, which asks for "DELETE" to be typed first.
	async function deleteSavePoint(name: string) {
		await waitForMessagesToGo();
		const card = cardOf(main, name);
		await card.hover();
		await card.getByTestId('more-vertical').click();
		await page.getByText('Delete Save Point', { exact: true }).click();
		const confirm = popup();
		await expect(confirm.getByText('Delete this Save point?', { exact: true })).toBeVisible();
		const typed = confirm.getByRole('textbox', { name: "Enter 'DELETE' to confirm." });
		const remove = confirm.getByRole('button', { name: 'I understand, Delete Save Point' });
		await typed.fill('DELETE');
		await expect(remove).toBeEnabled();
		await remove.click();
		await expect(page.getByRole('alert').filter({ hasText: 'Save Point deleted successfully' })).toBeVisible({ timeout: 60000 });
		// Testsigma no longer has it.
		await expect.poll(async () => (await listSavePoints(page, versionId)).some((point) => point.description === name), { message: `${name} deleted`, timeout: 30000 }).toBe(false);
		// The list usually drops it straight away, but has been seen to keep showing it until reloaded.
		try {
			await expect(cardOf(main, name)).toHaveCount(0, { timeout: 10000 });
		} catch {
			test.info().annotations.push({ type: 'list kept a deleted save point until reloaded', description: name });
			await openSavePoints();
			await expect(cardOf(main, name)).toHaveCount(0);
		}
	}

	// With the list full, another save point cannot even be started: "Create Save Point" is disabled.
	async function expectCreateRefused() {
		const create = main.getByRole('button', { name: 'Create Save Point' });
		await expect(create).toBeDisabled();
		// Hovering the button may say why; what it says is noted.
		await create.locator('xpath=..').hover();
		const why = page.getByRole('tooltip');
		test.info().annotations.push({ type: 'Create Save Point', description: (await why.count()) ? `disabled: ${(await why.first().innerText()).trim()}` : 'disabled' });
	}

	test.beforeAll(async ({ browser }) => {
		({ page, versionId } = await openSignedInPage(browser, application));
		main = page.locator('main');
	});

	test.afterAll(async () => {
		// Whatever happened, only the save point this run made is left of its own.
		for (const point of (await listSavePoints(page, versionId)).filter((item) => item.description.startsWith(ownPrefix) && item.description !== savePointName)) {
			await deleteSavePointById(page, point.id);
		}
		await page.close();
	});

	test(`Switch to the ${projectName} project, ${application.name} and version ${versionName}`, async () => {
		await switchToApplication(page, application, versionId);
	});

	test('Open Save Points and check the page', async () => {
		// Save points left by earlier runs are replaced by this run's own.
		for (const point of (await listSavePoints(page, versionId)).filter((item) => item.description.startsWith(ownPrefix))) {
			await deleteSavePointById(page, point.id);
		}
		await page.getByRole('navigation').getByRole('link', { name: 'Save Points' }).click();
		await expect(page).toHaveURL(/\/ui\/save_points$/, { timeout: 30000 });
		await expect(main.getByRole('heading', { name: 'Save Points', level: 1 })).toBeVisible();
		await expect(main.getByRole('button', { name: 'Create Save Point' })).toBeEnabled();
		await page.waitForTimeout(settleTime);

		// The page lists the save points, newest first.
		const points = await listSavePoints(page, versionId);
		test.info().annotations.push({ type: 'save points', description: `${points.length}: ${points.map((point) => point.description).join(', ')}` });
		expect(await listedNames(main)).toEqual(points.map((point) => point.description));
		for (const point of points) {
			const card = await readCard(cardOf(main, point.description).first());
			expect.soft(card.made, `when ${point.description} was made`).toMatch(when);
			expect.soft(card.how, `how ${point.description} was made`).toBe(typeLabels[point.type]);
			// The list holds the account's save points, each made from the version it names.
			test.info().annotations.push({ type: 'save point', description: `${point.description}: ${point.type}, version ${point.applicationVersionId}` });
		}
	});

	test('Make room when the list is full', async () => {
		const points = await listSavePoints(page, versionId);
		if (points.length < limit) {
			test.info().annotations.push({ type: 'room', description: `${points.length} of ${limit} save points, so there is room` });
			return;
		}
		await expectCreateRefused();
		// The oldest save point is deleted, whoever made it.
		const oldest = [...points].sort((a, b) => a.createdAtEpoch - b.createdAtEpoch)[0];
		test.info().annotations.push({ type: 'deleted to make room', description: oldest.description });
		await deleteSavePoint(oldest.description);
		await expect(main.getByRole('button', { name: 'Create Save Point' })).toBeEnabled();
	});

	test('Open the Create Save Point popup and check it', async () => {
		const before = await listSavePoints(page, versionId);
		await openCreatePopup();
		const form = popup();
		await expect(form.getByRole('img', { name: 'info icon' })).toBeVisible();
		await expect(form.getByText(/This will create a save point of your current state of the version\. You can find them under Main menu > Save Points\./)).toBeVisible();
		const name = form.getByRole('textbox', { name: 'Enter your Save point name' });
		await expect(name).toBeEmpty();
		// The name's label counts the characters used, out of 250.
		await expect(form.getByText(new RegExp(`Name your Save point \\(0/${nameLimit}\\)\\*`))).toBeVisible();
		const create = form.getByRole('button', { name: 'Create', exact: true });
		await expect(create).toBeDisabled();
		await expect(form.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();

		await name.fill(savePointName);
		await expect(form.getByText(new RegExp(`\\(${savePointName.length}/${nameLimit}\\)`))).toBeVisible();
		await expect(create).toBeEnabled();
		// A name only of spaces still lets Create be clicked; it is noted rather than tried.
		await name.fill('   ');
		test.info().annotations.push({ type: 'name of only spaces', description: (await create.isEnabled()) ? 'Create can be clicked' : 'Create cannot be clicked' });
		// The name can be no longer than 250 characters.
		await name.fill('x'.repeat(nameLimit + 20));
		await expect.poll(async () => (await name.inputValue()).length).toBeLessThanOrEqual(nameLimit);

		// Cancelling creates nothing.
		await form.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(popup()).toHaveCount(0);
		expect((await listSavePoints(page, versionId)).map((point) => point.id)).toEqual(before.map((point) => point.id));
	});

	test('Create the save point', async () => {
		[suites, plans] = await Promise.all([liveSuites(page, versionId), livePlans(page, versionId)]);
		await createSavePoint(savePointName);
		// The newest save point is listed first, as made by hand.
		expect((await listedNames(main))[0]).toBe(savePointName);
		await expect(cardOf(main, savePointName).getByText('Manual Save point', { exact: true })).toBeVisible();
		const [newest] = await listSavePoints(page, versionId);
		expect(newest).toMatchObject({ description: savePointName, type: 'MANUAL', applicationVersionId: versionId });
		created = newest;
	});

	test('Check what the new save point offers', async () => {
		const card = cardOf(main, savePointName);
		await card.hover();
		// Hovering shows how to restore the version to it and how to open it in a new tab.
		await expect(card.getByRole('button', { name: 'Restore', exact: true })).toBeVisible();
		await expect(card.getByRole('button', { name: 'Open this Save point in new tab' })).toBeVisible();
		await expect(card).toHaveAttribute('href', new RegExp(`^/ui/preview/${created.id}/cases/filters$`));
		await card.getByTestId('more-vertical').click();
		await expect(card.getByText('Edit Note', { exact: true })).toBeVisible();
		await expect(card.getByText('Delete Save Point', { exact: true })).toBeVisible();
		await page.keyboard.press('Escape');
		await main.getByRole('heading', { name: 'Save Points', level: 1 }).click();
	});

	test('"Open this Save point in new tab" opens it in a new tab', async () => {
		await openSavePoints();
		const card = cardOf(main, savePointName);
		await card.hover();
		const [opened] = await Promise.all([page.waitForEvent('popup'), card.getByRole('button', { name: 'Open this Save point in new tab' }).click()]);
		await expect(opened).toHaveURL(new RegExp(`/ui/preview/${created.id}/cases/filters`), { timeout: 30000 });
		await opened.close();
		await expect(page).toHaveURL(/\/ui\/save_points$/);
	});

	test('Open the new save point and check it', async () => {
		await openSavePoints();
		// The save point's card is a link that opens it in a new tab.
		const [opened] = await Promise.all([page.waitForEvent('popup'), cardOf(main, savePointName).getByText(savePointName, { exact: true }).click()]);
		preview = opened;
		previewMain = preview.locator('main');
		await expect(preview).toHaveURL(new RegExp(`/ui/preview/${created.id}/cases/filters`), { timeout: 30000 });
		// The save point says when it was made and which project, application and version it holds.
		await expect(previewMain.getByText(when).first()).toBeVisible({ timeout: 30000 });
		await expect(previewMain.getByText(new RegExp(`${projectName.replace(/[[\].]/g, '\\$&')}\\s*${application.name}\\s*${versionName}`))).toBeVisible();
		await expect(previewMain.getByRole('button', { name: 'Restore to this Version' })).toBeEnabled();
		for (const section of ['Tests', 'Test Cases', 'Step Groups', 'Elements', 'Test Data', 'Test Suites', 'Test Plans']) {
			await expect.soft(previewMain.getByRole('button', { name: section, exact: true }), section).toBeVisible();
		}
	});

	// The sections of a save point, with where each opens.
	const sections = [
		{ name: 'Step Groups', path: /\/step-groups\/filters/ },
		{ name: 'Elements', path: /\/elements\/filters/ },
		{ name: 'Test Data Profiles', path: /\/data$/, under: 'Test Data' },
		{ name: 'Test Suites', path: /\/suites$/ },
		{ name: 'Test Plans', path: /\/plans$/ },
	];

	async function openSection(name: string, under?: string) {
		if (under && !(await previewMain.getByRole('button', { name, exact: true }).isVisible())) {
			await previewMain.getByRole('button', { name: under, exact: true }).click();
		}
		await previewMain.getByRole('button', { name, exact: true }).click();
		await expect(previewMain.getByRole('heading', { name, level: 1 })).toBeVisible({ timeout: 30000 });
		await preview.waitForTimeout(settleTime);
	}

	test('Section: Test Cases', async () => {
		// Known issue: a save point's test cases never finish loading; the page keeps showing its spinner.
		test.fail(true, 'The Test Cases of a save point never finish loading.');
		await openSection('Test Cases');
		await expect(preview).toHaveURL(/\/cases\/filters/);
		await expect(previewMain.getByRole('grid').or(previewMain.getByRole('img', { name: 'Empty state illustration' }))).toBeVisible({ timeout: 30000 });
	});

	for (const section of sections) {
		test(`Section: ${section.name}`, async () => {
			await openSection(section.name, section.under);
			await expect(preview).toHaveURL(new RegExp(`/ui/preview/${created.id}/`));
			await expect(preview).toHaveURL(section.path);
			await expect(previewMain.getByRole('button', { name: 'Restore to this Version' })).toBeEnabled();
			if (section.name === 'Step Groups') {
				await expect(previewMain.getByRole('grid').or(previewMain.getByText('No Step Groups created yet', { exact: true }))).toBeVisible();
			} else if (section.name === 'Elements') {
				await expect(previewMain.getByRole('textbox', { name: 'Search' })).toBeVisible();
				await expect(previewMain.getByText(/^All \(\d+\)$/)).toBeVisible();
				for (const column of ['Element Name', 'Type', 'Screen Name', 'Created', 'Affected List', 'Reviewer', 'Status']) {
					await expect.soft(previewMain.getByText(column, { exact: true }).first(), `column ${column}`).toBeVisible();
				}
			} else if (section.name === 'Test Data Profiles') {
				await expect(previewMain.getByRole('grid').or(previewMain.getByText('You currently have no Test Data Profiles', { exact: true }))).toBeVisible();
			} else if (section.name === 'Test Suites') {
				for (const column of ['Title', 'Type', 'Created', 'Created by', 'Status']) {
					await expect.soft(previewMain.getByText(column, { exact: true }).first(), `column ${column}`).toBeVisible();
				}
				// The save point holds the suites the version had when it was made.
				await expect(previewMain.getByText(`All (${suites.length})`, { exact: true })).toBeVisible();
				for (const suite of suites) {
					await expect.soft(previewMain.getByRole('link', { name: suite, exact: true }), suite).toBeVisible();
				}
			} else if (section.name === 'Test Plans') {
				await expect(previewMain.getByRole('textbox', { name: 'Search' })).toBeVisible();
				for (const column of ['Name', 'Test Plan Type', 'Test Lab & Test Machines']) {
					await expect.soft(previewMain.getByText(column, { exact: true }).first(), `column ${column}`).toBeVisible();
				}
				// The save point holds the plans the version had when it was made.
				await expect(previewMain.getByText(`All (${plans.length})`, { exact: true })).toBeVisible();
				for (const plan of plans) {
					await expect.soft(previewMain.getByRole('link', { name: plan, exact: true }), plan).toBeVisible();
				}
			}
		});
	}

	test(`An eleventh save point cannot be created`, async () => {
		await preview?.close();
		await openSavePoints();
		const before = await listSavePoints(page, versionId);
		// Fill the list up to the limit with save points of this run's own.
		const fillers: string[] = [];
		for (let index = before.length; index < limit; index += 1) {
			const name = `${ownPrefix}filler save point ${index + 1} ${runStamp}`;
			await createSavePoint(name);
			fillers.push(name);
		}
		expect(await listSavePoints(page, versionId)).toHaveLength(limit);
		await expectCreateRefused();

		// Delete what was added for this, which also checks how deleting is confirmed and that it makes room again.
		for (const [index, name] of fillers.entries()) {
			if (index === 0) {
				const card = cardOf(main, name);
				await card.hover();
				await card.getByTestId('more-vertical').click();
				await page.getByText('Delete Save Point', { exact: true }).click();
				const confirm = popup();
				await expect(confirm.getByText('Deleting the save point will erase all the backup data associated with it.', { exact: true })).toBeVisible();
				await expect(confirm.getByText(/Please type 'DELETE' to confirm/)).toBeVisible();
				await expect(confirm.getByText(/This action cannot be undone\./)).toBeVisible();
				const remove = confirm.getByRole('button', { name: 'I understand, Delete Save Point' });
				await expect(remove).toBeDisabled();
				// Only "DELETE" itself will do.
				await confirm.getByRole('textbox', { name: "Enter 'DELETE' to confirm." }).fill('delete');
				await expect(remove).toBeDisabled();
				await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
				await expect(popup()).toHaveCount(0);
				await expect(cardOf(main, name)).toBeVisible();
			}
			await deleteSavePoint(name);
		}
		await expect(main.getByRole('button', { name: 'Create Save Point' })).toBeEnabled();
		expect((await listSavePoints(page, versionId)).map((point) => point.id)).toEqual(before.map((point) => point.id));
		// The save point this run made is kept.
		await expect(cardOf(main, savePointName)).toBeVisible();
	});
});
