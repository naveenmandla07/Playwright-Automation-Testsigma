/**
 * Testsigma's API for environments and the project's environment variables. It uses the signed-in page's session.
 */
import { expect, type Page, type Request } from '@playwright/test';

export type Variable = { id: number; key: string; value: string; projectId: number; isEncrypted: boolean; isDefault?: boolean };

// The variables of a project are saved as a batch, by this request.
export function isVariablesSave(request: Request) {
	return request.method() === 'PUT' && /\/private\/environments\/variables\?projectId=\d+$/.test(request.url());
}

export function findVariable(list: Variable[], key: string) {
	const variable = list.find((item) => item.key === key);
	expect(variable, `variable ${key}`).toBeDefined();
	return variable!;
}

export class EnvironmentsApi {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	get(id: number) {
		return this.page.request.get(`/private/environments/${id}`);
	}

	update(id: number, environment: { name: string; description: string; projectId?: number }) {
		return this.page.request.put(`/private/environments/${id}`, { data: { id, ...environment } });
	}

	delete(id: number) {
		return this.page.request.delete(`/private/environments/${id}`);
	}

	// The project's variables, with their default values.
	async projectVariables(projectId: number): Promise<Variable[]> {
		const response = await this.page.request.get(`/private/environments/variables?query=projectId:${projectId}&size=500&page=0`);
		expect(response.ok()).toBe(true);
		return (await response.json()).content;
	}

	// Values set inside an environment override the project default for that environment only.
	async environmentVariables(projectId: number, environmentId: number): Promise<Variable[]> {
		const response = await this.page.request.get(`/private/environments/variables/${projectId}/${environmentId}?size=500&page=0`);
		expect(response.ok()).toBe(true);
		return (await response.json()).content;
	}

	// Deletes one variable. A save only deletes the first variable marked for deletion, so delete them one at a time.
	deleteVariable(projectId: number, { id, key, value, isEncrypted }: Variable) {
		return this.page.request.put(`/private/environments/variables?projectId=${projectId}`, {
			data: [{ id, key, value, projectId, isEncrypted, markAsDeleted: true }],
		});
	}
}
