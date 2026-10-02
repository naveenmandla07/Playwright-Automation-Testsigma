/**
 * The details of a generated test case, opened over the Atto playground: its title and badges, its manual and
 * automated steps, and the ways to run it.
 */
import { BasePage } from '../BasePage';

// A step starts with what it does.
const step = /^(Navigate|Wait|Enter|Click|Verify|Open|Select|Submit|Type)\b/i;

export class GeneratedTestCaseModal extends BasePage {
	readonly heading = this.page.getByRole('heading', { name: 'Test Case Details', exact: true }).filter({ visible: true });
	readonly moveWith = this.visibleText('Move with');
	readonly previousButton = this.visibleButton('Navigate to previous test case');
	readonly nextButton = this.visibleButton('Navigate to next test case');
	readonly closeButton = this.visibleButton('Close modal');
	readonly title = this.page.getByRole('heading', { level: 1 }).filter({ visible: true });
	readonly manualStepsTab = this.visibleButton('Manual Steps');
	readonly automatedStepsTab = this.visibleButton('Automated Steps');
	readonly steps = this.page.getByText(step).filter({ visible: true });
	readonly editButton = this.visibleButton('Edit');
	readonly generateAutomatedSteps = this.page.getByRole('button', { name: /Generate Automated Steps$/ }).filter({ visible: true });
	readonly contextHint = this.page.getByText(/Leverage provided context to create steps/i).filter({ visible: true });
	readonly agenticLearning = this.visibleText('Agentic Learning');
	readonly runWithCopilot = this.page.getByRole('button', { name: /Run with Copilot$/ }).filter({ visible: true });

	// The run options, which open in a popup the page reports as hidden.
	readonly testsigmaLab = this.page.getByRole('button', { name: /Testsigma Lab$/, includeHidden: true });
	readonly localDevicesLab = this.page.getByRole('button', { name: /Local Devices$/, includeHidden: true });
	readonly copilotUnavailable = this.page.getByText(/Copilot is unavailable/);
	readonly agentNotRunning = this.page.getByText(/Not Installed|Not Started/);
	readonly terminalOffline = this.page.getByText('Terminal is offline', { exact: true });
	readonly launchButton = this.page.getByRole('button', { name: 'Launch', exact: true, includeHidden: true });
	readonly cancelButton = this.page.getByRole('button', { name: 'Cancel', exact: true, includeHidden: true });

	visibleButton(name: string) {
		return this.page.getByRole('button', { name, exact: true }).filter({ visible: true });
	}

	visibleText(text: string) {
		return this.page.getByText(text, { exact: true }).filter({ visible: true });
	}

	// The badges beside the title, such as "New" and "Pending".
	badge(text: string) {
		return this.page.locator('span.px-2').filter({ visible: true }).filter({ hasText: new RegExp(`^${text}$`) });
	}
}
