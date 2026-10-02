/**
 * Atto, Testsigma's AI: its home page, and the playground where it generates test cases from a prompt and saves
 * them to the library.
 */
import { expect } from '@playwright/test';
import { BasePage } from '../BasePage';
import { GeneratedTestCaseModal } from './GeneratedTestCaseModal';

export class AttoHomePage extends BasePage {
	readonly generateButton = this.page.getByRole('button', { name: /ai_journey\.generate\.with\.ai/i }).first();

	async open(versionId: string) {
		await this.page.goto(`/ui/ai-journey/${versionId}`);
		await expect(this.page).toHaveURL(new RegExp(`/ui/ai-journey/${versionId}`));
	}

	async startGenerating() {
		await expect(this.generateButton).toBeEnabled();
		await this.generateButton.click();
		await this.page.waitForURL(/\/ui\/playground\//, { timeout: 30000 });
		return new AttoPlaygroundPage(this.page);
	}
}

export class AttoPlaygroundPage extends BasePage {
	readonly promptField = this.page.getByRole('textbox', { name: 'Describe the feature or flow you want to test...' });
	readonly readLibraryCheckbox = this.page.getByRole('checkbox', { name: 'Read existing test case library' });
	readonly generateButton = this.page.getByRole('button', { name: /Generate with AI/ }).last();
	// Shown once at least one test case is generated.
	readonly generatedCases = this.page.getByRole('button', { name: /All test cases \([1-9]\d*\)/ });
	readonly resultTabs = [
		this.page.getByRole('button', { name: /^All test cases \(\d+\)$/ }),
		this.page.getByRole('button', { name: /^Pending \(\d+\)$/ }),
		this.page.getByRole('button', { name: /^Accepted \(\d+\)$/ }),
		this.page.getByRole('button', { name: /^Rejected \(\d+\)$/ }),
	];
	// The count beside the first group of generated cases, which unfolds the group.
	readonly firstGroupCount = this.page.getByText(/^\(\d+\)$/).first();
	readonly firstTestCase = this.page.getByRole('button', { name: /New.*Pending/ }).first();
	readonly modal = new GeneratedTestCaseModal(this.page);

	// Saving to the library first asks for the folder to save in.
	readonly saveToLibrary = this.visibleButton('Save to Library');
	readonly selectLocation = this.page.getByText('Select Location', { exact: true }).filter({ visible: true });
	readonly locationSearch = this.page.getByRole('textbox', { name: 'Search', exact: true }).filter({ visible: true });
	readonly targetFolderLabel = this.page.getByText('Target Folder', { exact: true }).filter({ visible: true });
	readonly confirmLocation = this.visibleButton('Confirm');
	readonly saveButton = this.visibleButton('Save');

	visibleButton(name: string) {
		return this.page.getByRole('button', { name, exact: true }).filter({ visible: true });
	}

	// The checkbox is drawn over by its label, which takes the click.
	async stopReadingLibrary() {
		if (await this.readLibraryCheckbox.isChecked()) {
			await this.page.getByText('Read existing test case library', { exact: true }).click();
		}
		await expect(this.readLibraryCheckbox).not.toBeChecked();
	}

	locationFolder(name: string) {
		return this.visibleButton(name);
	}
}
