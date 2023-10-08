import NotionAPI from "./api";

export default class NotionService {
	constructor(
		private api: NotionAPI,
		private otherParams?: any,
	) {}

	async getPage(pageId?: string, other?: any) {
		return this.api.getPage({
			params: pageId ? { pageId: pageId } : undefined,
			other: this.otherParams,
		});
	}

	async getDatabase(databaseId?: string, other?: any) {
		return this.api.getDatabase({
			params: databaseId ? { databaseId: databaseId } : undefined,
			other: this.otherParams,
		});
	}

	async getBlockChildren(blockId?: string, other?: any) {
		return this.api.getBlockChildren({
			params: blockId ? { blockId: blockId } : undefined,
			other: this.otherParams,
		});
	}

	async getBlock(blockId?: string, other?: any) {
		return this.api.getBlockChildren({
			params: blockId ? { blockId: blockId } : undefined,
			other: this.otherParams,
		});
	}

	async queryDatabase(databaseId: string, query: any, other?: any) {
		return this.api.queryDatabase({
			params: databaseId ? { databaseId: databaseId } : undefined,
			body: query,
			other: this.otherParams,
		});
	}

	async search(query: string, other?: any) {
		return this.api.search({
			body: query,
			other: this.otherParams,
		});
	}

	async getUser(userId: string, other?: any) {
		return this.api.getUser({
			params: userId ? { userId: userId } : undefined,
			other: this.otherParams,
		});
	}

	async createPage(body: any, other?: any) {
		return this.api.createPage({
			body: body,
			other: this.otherParams,
		});
	}

	async deleteBlock(blockId: string, other?: any) {
		return this.api.deleteBlock({
			params: blockId ? { blockId: blockId } : undefined,
			other: this.otherParams,
		});
	}

	async updateBlock(blockId: string, body: any, other?: any) {
		return this.api.updateBlock({
			params: blockId ? { blockId: blockId } : undefined,
			body: body,
			other: this.otherParams,
		});
	}
}