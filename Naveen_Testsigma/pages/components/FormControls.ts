/**
 * Form controls Testsigma draws itself rather than with the browser's own: overlays, labelled dropdowns, toggles and
 * radio buttons hidden behind their labels. Each helper works inside the part of the page it is given.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { escapeRegExp } from '../../support/common';

// Modals and drawers here are often plain overlays rather than dialogs, so find each by its title and main button.
export function overlay(page: Page, title: string, button: string | RegExp) {
	return page.locator('div')
		.filter({ has: page.getByText(title, { exact: true }) })
		.filter({ has: page.getByRole('button', { name: button }) })
		.last();
}

// Field labels can carry a required-field asterisk, e.g. "Test Lab *".
export function fieldLabel(scope: Locator, label: string) {
	return scope.getByText(new RegExp(`^${escapeRegExp(label)}\\s*\\*?$`)).first();
}

// A dropdown sits next to its label and shows the chosen value; it reports whether it is open in data-isopen.
export function dropdown(scope: Locator, label: string) {
	return fieldLabel(scope, label).locator('..').locator('[data-isopen]').first();
}

export async function openDropdown(field: Locator) {
	await field.click();
	await expect(field).toHaveAttribute('data-isopen', 'true');
}

// Escape leaves a dropdown open, and clicking the dropdown again can land on one of its options, so close it by
// clicking a heading next to it.
export async function closeDropdown(field: Locator, heading: Locator) {
	await heading.click();
	await expect(field).toHaveAttribute('data-isopen', 'false');
}

// The label switch of a toggle, which is what takes the click; see turnOn.
export function toggle(scope: Locator, name: string) {
	return scope.locator('label').filter({ has: scope.page().getByRole('checkbox', { name, exact: true }) });
}

// The hidden checkbox of a toggle does not take clicks; its switch, the surrounding label, does.
export async function turnOn(scope: Locator, name: string) {
	const checkbox = scope.getByRole('checkbox', { name, exact: true });
	if (!(await checkbox.isChecked())) {
		await toggle(scope, name).click();
	}
	await expect(checkbox).toBeChecked();
}

// Radio buttons are hidden behind their labels, so choose one by clicking its text.
export async function choose(scope: Locator, name: string) {
	await scope.getByText(name, { exact: true }).click();
	await expect(scope.getByRole('radio', { name, exact: true })).toBeChecked();
}
