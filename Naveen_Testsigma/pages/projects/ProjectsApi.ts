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

	// The id of a version, found by the names of its project, application and version; the application must be of
	// the type given, e.g. "WebApplication".
	async findVersionId(projectName: string, applicationName: string, applicationType: string, versionName: string) {
		const project = (await this.list()).find((item) => item.name === projectName);
		expect(project, `project ${projectName}`).toBeDefined();
		const applications = (await (await this.page.request.get(`/private/applications?query=projectId:${project!.id}&size=100&page=0`)).json()).content;
		const application = applications.find((item: { name: string }) => item.name === applicationName);
		expect(application, `application ${applicationName}`).toBeDefined();
		expect(application.applicationType).toBe(applicationType);
		const versions = (await (await this.page.request.get(`/private/application_versions?query=applicationId:${application.id}&page=0&size=0`)).json()).content;
		const version = versions.find((item: { versionName: string }) => item.versionName === versionName);
		expect(version, `version ${versionName}`).toBeDefined();
		return version.id as number;
	}
}
