/**
 * A save point opened in a tab of its own, showing what its version held when it was made, section by section.
 */
import { expect } from '@playwright/test';
import { escapeRegExp } from '../../support/common';
import { BasePage } from '../BasePage';
import { settleTime, when } from './SavePointsPage';

export class SavePointPreviewPage extends BasePage {
	readonly restoreButton = this.main.getByRole('button', { name: 'Restore to this Version' });
	// When the save point was made.
	readonly madeAt = this.main.getByText(when).first();
	readonly grid = this.main.getByRole('grid');
	readonly searchField = this.main.getByRole('textbox', { name: 'Search' });

	// The project, application and version the save point holds.
	heldVersion(project: string, application: string, version: string) {
		return this.main.getByText(new RegExp(`${escapeRegExp(project)}\\s*${application}\\s*${version}`));
	}

	sectionButton(name: string) {
		return this.main.getByRole('button', { name, exact: true });
	}

	// A column heading of the section's list.
	column(name: string) {
		return this.main.getByText(name, { exact: true }).first();
	}

	// The count of everything in the section, e.g. "All (3)".
	allCount(count?: number) {
		return count === undefined ? this.main.getByText(/^All \(\d+\)$/) : this.main.getByText(`All (${count})`, { exact: true });
	}

	// Opens a section from the side menu, first expanding the group it is under when it is hidden.
	async openSection(name: string, under?: string) {
		if (under && !(await this.sectionButton(name).isVisible())) {
			await this.sectionButton(under).click();
		}
		await this.sectionButton(name).click();
		await expect(this.main.getByRole('heading', { name, level: 1 })).toBeVisible({ timeout: 30000 });
		await this.page.waitForTimeout(settleTime);
	}
}
