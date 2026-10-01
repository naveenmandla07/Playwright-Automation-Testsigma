/**
 * Testsigma's API for a version's test suites, and for the test cases a suite can hold. It uses the signed-in page's
 * session.
 */
import { expect, type Page, type Request } from '@playwright/test';

export type Suite = { id: number; name: string; totalTestCasesCount: number };
export type TestCase = { id: number; name: string };

// The request that creates a suite.
export function isSuiteCreate(request: Request) {
	return request.method() === 'POST' && /\/private\/test_suites$/.test(request.url());
}

export class TestSuitesApi {
	readonly page: Page;
	readonly versionId: number;

	constructor(page: Page, versionId: number) {
		this.page = page;
		this.versionId = versionId;
	}

	async list(): Promise<Suite[]> {
		const response = await this.page.request.get(`/private/test_suites?query=appVersionId:${this.versionId},suiteType:TS_SUITE&size=500&page=0`);
		expect(response.ok()).toBe(true);
		return (await response.json()).content;
	}

	async deleteNamed(name: string) {
		for (const suite of (await this.list()).filter((item) => item.name === name)) {
			expect((await this.page.request.delete(`/private/test_suites/${suite.id}`)).ok()).toBe(true);
		}
	}

	async get(id: number) {
		return (await this.page.request.get(`/private/test_suites/${id}`)).json();
	}

	// The same test cases the picker lists: ready, automated test cases of the version that are not step groups.
	async pickableTestCases(): Promise<TestCase[]> {
		const query = `status:READY,afterTestParentId:null,deleted:false,isStepGroup:false,isManual:false,applicationVersionId:${this.versionId},isEligibleForAfterSuite:false`;
		const response = await this.page.request.get(`/private/test_cases?query=${query}&size=500&page=0`);
		expect(response.ok()).toBe(true);
		return (await response.json()).content.map(({ id, name }: TestCase) => ({ id, name }));
	}
}
