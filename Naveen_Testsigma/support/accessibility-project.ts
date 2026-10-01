/**
 * The "[9.0.8] Accessibility" project that the Test Suite, Test Plan and Save Point specs work in: each works in one
 * of its applications, always on version "1".
 */
import type { Browser, Page } from '@playwright/test';
import { ProjectSwitcher } from '../pages/projects/ProjectSwitcher';
import { ProjectsApi } from '../pages/projects/ProjectsApi';
import { signInToTestsigma } from './testsigma-auth';

export const projectName = '[9.0.8] Accessibility';
export const versionName = '1';

// An application of the project, as named in the project switcher, with its Testsigma application type.
export type SuiteApplication = { name: string; type: string };

// Opens a page of its own, signs in and finds the id of the application's version "1".
export async function openSignedInPage(browser: Browser, { name, type }: SuiteApplication) {
	const page = await browser.newPage();
	page.setDefaultTimeout(15000);
	page.setDefaultNavigationTimeout(30000);
	await signInToTestsigma(page);
	return { page, versionId: await new ProjectsApi(page).findVersionId(projectName, name, type, versionName) };
}

// Makes the project, the application and its version "1" current.
export async function switchToApplication(page: Page, { name }: SuiteApplication, versionId: number) {
	await new ProjectSwitcher(page).switchTo({ project: projectName, application: name, version: versionName }, versionId);
}
