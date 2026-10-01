/**
 * Testsigma's API for one version's save points, and for what the version holds now, which a save point made now
 * must hold too. It uses the signed-in page's session.
 */
import { expect, type Page } from '@playwright/test';

export type SavePoint = { id: number; description: string; type: 'MANUAL' | 'IMPORT'; createdAtEpoch: number; applicationVersionId: number };

export class SavePointsApi {
	readonly page: Page;
	readonly versionId: number;

	constructor(page: Page, versionId: number) {
		this.page = page;
		this.versionId = versionId;
	}

	// The save points, newest first.
	async list(): Promise<SavePoint[]> {
		const response = await this.page.request.get(`/versioning/save_points?applicationVersionId=${this.versionId}&size=100&page=0&sort=id,desc`);
		expect(response.ok()).toBe(true);
		return response.json();
	}

	async delete(id: number) {
		expect((await this.page.request.delete(`/versioning/save_points/${id}`)).ok()).toBe(true);
	}

	async suiteNames(): Promise<string[]> {
		const response = await this.page.request.get(`/private/test_suites?query=appVersionId:${this.versionId},suiteType:TS_SUITE&size=500&page=0`);
		return (await response.json()).content.map((suite: { name: string }) => suite.name).sort();
	}

	async planNames(): Promise<string[]> {
		const response = await this.page.request.get(`/executions?query=applicationVersionId:${this.versionId},entityType:EXECUTION&size=500&page=0`);
		return (await response.json()).content.map((plan: { name: string }) => plan.name).sort();
	}
}
