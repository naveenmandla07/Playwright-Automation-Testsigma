/**
 * Testsigma's API for test data profiles and their folders. It uses the signed-in page's session.
 */
import type { Page } from '@playwright/test';

export class TestDataApi {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	createFolder(folder: { name: string; versionId: number; parentId: number | null; type: 'FEATURE' | 'SCENARIO' }) {
		return this.page.request.post('/private/test_data/folders', { data: folder });
	}

	getFolder(id: number) {
		return this.page.request.get(`/private/test_data/folders/${id}`);
	}

	deleteFolder(id: number) {
		return this.page.request.delete(`/private/test_data/folders/${id}`);
	}

	// Creates a profile with one data set, of one value per parameter.
	createProfile({ name, versionId, folderId, setName, values }: { name: string; versionId: number; folderId: number; setName: string; values: Record<string, string> }) {
		return this.page.request.post('/private/test_data', {
			data: {
				createType: 'MANUAL',
				data: [{ selected: false, expectedToFail: false, name: setName, data: values }],
				passwords: [],
				columns: Object.keys(values),
				renamedColumns: {},
				name,
				testDataName: name,
				versionId: String(versionId),
				testDataFolderId: folderId,
			},
		});
	}

	getProfile(id: number) {
		return this.page.request.get(`/private/test_data/${id}`);
	}

	deleteProfile(id: number, versionId: number) {
		return this.page.request.delete(`/private/test_data/${id}?applicationVersionId=${versionId}`);
	}
}
