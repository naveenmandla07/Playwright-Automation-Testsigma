/**
 * Testsigma's API for a version's test plans and the machine profiles linked to a plan. It uses the signed-in page's
 * session. Plans and their machines are served from the site root rather than /private.
 */
import { expect, type Page, type Request } from '@playwright/test';

export type Plan = { id: number; name: string };
export type PlanMachine = { id: number; title: string; suiteIds: number[]; isPredefined: boolean; platformDeviceId: string | null } & Record<string, unknown>;

// The request that creates a plan.
export function isPlanCreate(request: Request) {
	return request.method() === 'POST' && /\/executions$/.test(new URL(request.url()).pathname);
}

export class TestPlansApi {
	readonly page: Page;
	readonly versionId: number;

	constructor(page: Page, versionId: number) {
		this.page = page;
		this.versionId = versionId;
	}

	async list(): Promise<Plan[]> {
		const response = await this.page.request.get(`/executions?query=applicationVersionId:${this.versionId},entityType:EXECUTION&size=500&page=0`);
		expect(response.ok()).toBe(true);
		return (await response.json()).content;
	}

	// Deletes every plan with the name and waits until none is listed.
	async deleteNamed(name: string) {
		for (const plan of (await this.list()).filter((item) => item.name === name)) {
			expect((await this.page.request.delete(`/executions/${plan.id}`)).ok()).toBe(true);
		}
		await expect.poll(async () => (await this.list()).some((item) => item.name === name)).toBe(false);
	}

	async machines(planId: number): Promise<PlanMachine[]> {
		const response = await this.page.request.get(`/execution_environments?query=executionId:${planId}&fetchSuitesCount=true&page=0&size=100`);
		expect(response.ok()).toBe(true);
		return (await response.json()).content;
	}
}
