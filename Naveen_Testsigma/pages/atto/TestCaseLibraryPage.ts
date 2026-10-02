/**
 * The test case library of a version: its folder tree, each folder named with how many test cases it holds, e.g.
 * "AI Generated Feature (12)".
 */
import { expect } from '@playwright/test';
import { escapeRegExp } from '../../support/common';
import { BasePage } from '../BasePage';

export class TestCaseLibraryPage extends BasePage {
	readonly tree = this.page.getByRole('tree');

	async open(versionId: string) {
		await this.page.goto(`/ui/td/${versionId}/cases/filters`);
		await expect(this.tree).toBeVisible({ timeout: 30000 });
	}

	folder(name: string) {
		return this.tree.getByRole('button', { name: new RegExp(`^${escapeRegExp(name)} \\(\\d+\\)$`) });
	}

	async folderCount(name: string) {
		const countMatch = (await this.folder(name).innerText()).match(/\((\d+)\)$/);
		return Number(countMatch?.[1] ?? 0);
	}

	// A test case listed under an opened folder.
	testCase(title: string) {
		return this.tree.getByRole('link').filter({ hasText: title }).last();
	}
}
