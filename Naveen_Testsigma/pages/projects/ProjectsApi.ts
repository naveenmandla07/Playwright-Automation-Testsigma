/**
 * Testsigma's API for the account's projects. It uses the signed-in page's session.
 */
import { expect, type Page } from '@playwright/test';

export type Project = { id: number; name: string };

export class ProjectsApi {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	async list(): Promise<Project[]> {
		return (await (await this.page.request.get('/private/projects?size=500&page=0')).json()).content;
	}

	async delete({ id, name }: Project) {
		expect((await this.page.request.delete(`/private/projects/${id}`)).ok(), `delete ${name}`).toBe(true);
	}
}
