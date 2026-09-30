/**
 * The Certificates tab of Admin Settings.
 *
 * Scenarios (run in order, sharing one signed-in page):
 * - Open the Certificates tab and check its elements, and the certificates listed or that there are none.
 * - Open "Add certificate" and check the form: the host and port, the two certificate formats and the files each
 *   asks for, the optional passphrase and CA chain, and the note that the certificate is shared with the project.
 * - Switch between the two formats, and cancel the form.
 *
 * Nothing is added: no file is chosen, "Add certificate" in the form is never clicked, and the form is cancelled.
 */
import { expect, test } from '@playwright/test';
import { expectTabElements, openTab, useSettingsTab } from '../../support/admin-settings';

test.describe('Verify the Certificates', () => {
	const run = useSettingsTab('Certificates');

	function certificateForm() {
		return run.page.getByRole('dialog');
	}

	async function openForm() {
		await run.main.getByRole('button', { name: 'Add certificate' }).click();
		await expect(certificateForm().getByText('Add client certificate', { exact: true })).toBeVisible();
	}

	async function cancelForm() {
		await certificateForm().getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(certificateForm()).toHaveCount(0);
	}

	// The file types a file field accepts, e.g. ".crt,.pem,.cer".
	async function acceptedFiles() {
		return certificateForm().locator('input[type=file]').evaluateAll((inputs) => inputs.map((input) => input.getAttribute('accept') ?? ''));
	}

	test('Open the Certificates tab and check its elements', async () => {
		await openTab(run.page, run.tab);
		await expectTabElements(run.main, run.tab);
		const none = run.main.getByText('No client certificates registered for this project yet.', { exact: true });
		test.info().annotations.push({ type: 'certificates', description: (await none.isVisible()) ? 'none' : `${await run.main.getByRole('grid').getByRole('row').count()} rows` });
	});

	test('Open the Add certificate form and check its fields', async () => {
		await openForm();
		const form = certificateForm();
		const host = form.getByRole('textbox', { name: 'Host', exact: true });
		await expect(host).toBeEmpty();
		// The placeholder reads as it is shown, "getestsigma.com".
		await expect(host).toHaveAttribute('placeholder', 'getestsigma.com');
		// Certificates are for HTTPS, so the port starts at 443.
		await expect(form.getByRole('textbox', { name: 'Port', exact: true })).toHaveValue('443');
		await expect(form.getByRole('textbox', { name: 'Port', exact: true })).toHaveAttribute('placeholder', '443 or *');
		await expect(form.getByText(/Use \*\.testsigma\.com to cover every host in an estate\./)).toBeVisible();
		await expect(form.getByText(/^Certificate format/)).toBeVisible();
		for (const format of ['CRT + KEY', 'PFX bundle']) {
			await expect.soft(form.getByRole('button', { name: format, exact: true }), format).toBeVisible();
		}
		await expect(form.getByText(/A PFX bundle carries the certificate and key together, so you only need one of these\./)).toBeVisible();
		// A certificate and its private key, each as a file of its own.
		for (const field of [/^Certificate file/, /^Private key file/, /^CA or chain certificate \(Optional\)/]) {
			await expect.soft(form.getByText(field).first(), String(field)).toBeVisible();
		}
		await expect(form.getByText('Browse file', { exact: true })).toHaveCount(3);
		await expect(form.getByRole('textbox', { name: 'Passphrase', exact: true })).toBeEmpty();
		await expect(form.getByText(/Required only if the private key or PFX bundle is encrypted\. Stored encrypted and never shown again\./)).toBeVisible();
		await expect(form.getByText(/Add this if the endpoint is signed by a private or ecosystem CA rather than a public one\./)).toBeVisible();
		await expect(form.getByText(/This certificate is available to everyone on the project\./)).toBeVisible();
		await expect(form.getByRole('button', { name: 'Add certificate', exact: true })).toBeVisible();
		await cancelForm();
	});

	test('Each certificate format asks for its own files', async () => {
		await openForm();
		const form = certificateForm();
		// CRT + KEY: a certificate, a private key and an optional CA chain.
		const [certificate, key, chain] = await acceptedFiles();
		for (const type of ['crt', 'pem', 'cer']) {
			expect.soft(certificate, `certificate file accepts .${type}`).toContain(type);
		}
		for (const type of ['key', 'pem', 'pkey']) {
			expect.soft(key, `private key file accepts .${type}`).toContain(type);
		}
		expect.soft(chain, 'CA chain accepts .crt').toContain('crt');

		// PFX bundle: one file carries both, so the private key is no longer asked for.
		await form.getByRole('button', { name: 'PFX bundle', exact: true }).click();
		await expect(form.getByText(/^Certificate file \(PFX\)/)).toBeVisible();
		await expect(form.getByText(/^Private key file/)).toHaveCount(0);
		await expect(form.getByText('Browse file', { exact: true })).toHaveCount(2);
		const [bundle] = await acceptedFiles();
		for (const type of ['pfx', 'p12']) {
			expect.soft(bundle, `PFX bundle accepts .${type}`).toContain(type);
		}

		await form.getByRole('button', { name: 'CRT + KEY', exact: true }).click();
		await expect(form.getByText(/^Private key file/)).toBeVisible();
		await expect(form.getByText('Browse file', { exact: true })).toHaveCount(3);
		await cancelForm();
	});
});
