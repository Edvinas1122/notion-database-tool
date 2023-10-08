import NotionService from "./api/notion.service";
import { BadRequestException, ConflictException } from "./exception/exceptions";
import {
	Table, Properties
} from "./db-generics/table";

/*
	Provides a service for mapping content that requires
	paraller requests to Notion's API.
*/

interface NotionBlock {
	object: string;
	id: string;
	type: string;
	has_children: boolean;
	children?: NotionBlock[];
	numbered_list_item?: any;
	child_database?: any;
}

enum NestedBlocks {
	// page = "page",
	bulleted_list_item = "bulleted_list_item",
	numbered_list_item = "numbered_list_item",
	child_page = "child_page",
	// to_do = "to_do",
	// quote = "quote",
	// callout = "callout",
}

interface FormatConfiguration {
	nestedTypes: string[];
	linkedTypes: string[];
}

const FormatConfiguration: FormatConfiguration = {
	nestedTypes: [
		NestedBlocks.numbered_list_item,
		NestedBlocks.bulleted_list_item,
	],
	linkedTypes: [
		NestedBlocks.child_page,
	],

}

export default class NotionFormatterService {
	constructor(
		private notion: NotionService,
		// private render: NotionRendererService,
	) {}

	async getPageContent(pageId?: string): Promise<NotionBlock[]> {
		const list = await this.notion.getBlockChildren(pageId);
		if (!list.results) throw new BadRequestException("No results found");
		const updatedList = await this.handleSubBlocks(list.results);
		list.results = updatedList;
		return list;
	}

	async getPropertiesList(databeseId: string, query?: any): Promise<any[]> {
		const list = await this.notion.queryDatabase(databeseId, query);
		if (!list.results) throw new BadRequestException("No results found");
		const filteredList = list.results.map((item: any) => {
			return item.properties;
		});
		return filteredList;
	}

	async getUser(userId: string): Promise<any> {
		const user = await this.notion.getUser(userId);
		if (!user) throw new BadRequestException("No results found");
		return user;
	}

	/*
		Aquire entries
	*/
	async getDatabaseContent(databaseId: string, query?: any): Promise<DatabaseList> {
		const list = await this.notion.queryDatabase(databaseId, query);
		if (!list.results) throw new BadRequestException(list.message);
		return new DatabaseList(list, this.notion);
	}

	async getPage(pageId: string): Promise<any> {
		const page = await this.notion.getPage(pageId);
		if (!page) throw new BadRequestException("No results found");
		return new Page(page, this.notion);
	}

	public getDatabaseEntryBuilder(database_id: string): any {
		return new DatabaseEntryBuilder(database_id, this.notion);
	}

	/*
		query builder to aquire filtered entries
	*/
	public getDatabaseQueryBuilder(database_id: string): any {
		return new DatabaseQueryBuilder(database_id, this.notion);
	}

	private async handleSubBlocks(blocks: NotionBlock[]): Promise<NotionBlock[]> {
		const updatedList = await Promise.all(blocks.map(async (block: NotionBlock) => {
			if (block.has_children === false) return block;
			return this.getBlockSubContents(block);
		}));
		return updatedList;
	}

	private async getBlockSubContents(block: NotionBlock): Promise<NotionBlock> {
		if (FormatConfiguration.nestedTypes.includes(block.type)) {
			return await this.handleNestedBlock(block);
		} else if (FormatConfiguration.linkedTypes.includes(block.type)) {
			return await this.handleLinkedBlocks(block);
		}
		return block;
	}

	private async handleNestedBlock(block: NotionBlock): Promise<NotionBlock> {
		const children = await this.notion.getBlockChildren(block.id);
		if (!children.results) throw new ConflictException({ message: "notion api data integrity logic failure" });
		children.results = await this.handleSubBlocks(children.results);
		block.children = children;
		return block;
	}

	private async handleLinkedBlocks(block: NotionBlock): Promise<NotionBlock> {
		const linkedPage = await this.notion.getPage(block.id);
		if (!linkedPage.properties) throw new ConflictException({ message: "notion api data integrity logic failure" });
		block.children = linkedPage;
		return block;
	}
}

export type TableProps = {
	name: string;
	database_id: string;
	properties: Properties;
}

// export class NotionDatabaseTool {
// 	constructor(
// 		private notion: NotionService,
// 		private tables: TableProps[],
// 	) {}

// 	getTable(name: string): Table {
// 		const table = this.tables.find((table) => table.name === name);
// 		if (!table) throw new BadRequestException("No table found");
// 		return new Table(
// 			table.database_id,
// 			table.properties,
// 			new DatabaseQueryBuilder(table.database_id, this.notion),
// 			new DatabaseEntryBuilder(table.database_id, this.notion),
// 		);
// 	}

// }

/*
	Insert an entry
*/
class DatabaseEntryBuilder {
	private properties: any = {};

	constructor(
		private database_id: string,
		private notion: NotionService, // Make sure NotionService is properly imported and defined
	) {}

	public addTitle(name: string, content: string) {
		this.properties[name] = {
			title: [
			{
				text: {
				content: content,
				},
			},
			],
		};
		return this;
	}

	public addRichText(name: string, content: string) {
		this.properties[name] = {
			rich_text: [
			{
				text: {
				content: content,
				},
			},
			],
		};
		return this;
	}

	public addUrl(name: string, url: string) {
		this.properties[name] = {
			url: url,
		};
		return this;
	}

	public addNumber(name: string, number: number) {
		this.properties[name] = {
			number: number,
		};
		return this;
	}

	public async postEntry(): Promise<any> {
		const formattedProperties = {
			parent: { database_id: this.database_id },
			properties: this.properties,
		};
		return await this.notion.createPage(formattedProperties);
	}
}

enum FilterCondition {
	equals = "equals",
	does_not_equal = "does_not_equal",
	greater_than = "greater_than",
	less_than = "less_than",
	containts = "contains",
}

enum FilteredDataType {
	number = "number",
	relation = "relation",
}


/*
	Table ID contexted
*/
class DatabaseQueryBuilder {
	private filterTokens: any[] = [];
	private filter: any = {};
	private sorts: any[] = [];
	constructor(
		private database_id: string,
		private notion: NotionService,
	) {
	}

	private convertFilterInfoToFilter() {
		if (this.filterTokens.length === 1) {
			this.filter = this.filterTokens[0];
			return;
		}
		let currentNode = this.filter;
		this.filterTokens.forEach((token) => {
			if (token.token === "and") {
				currentNode.and = [];
				currentNode = currentNode.and;
			} else if (token.token === "or") {
				currentNode.or = [];
				currentNode = currentNode.or;
			} else {
				currentNode.push(token);
			}
		});
	}

	public and() {
		this.filterTokens.push({
			token: "and",
		});
		return this;
	}

	public or() {
		this.filterTokens.push({
			token: "or",
		});
		return this;
	}

	public addFilter(
		propertyName: string,
		dataType: FilteredDataType,
		matching: FilterCondition,
		value: any
	) {
		this.filterTokens.push({
			property: propertyName,
			[dataType]: {
				[matching]: value,
			}
		});
		return this;
	}

	public addSort(
		propertyName: string,
		direction: "ascending" | "descending"
	) {
		this.sorts.push({
			property: propertyName,
			direction: direction,
		});
		return this;
	}

	/*
		Aquire entries
	*/
	public async execute(): Promise<DatabaseList> {
		this.convertFilterInfoToFilter();
		const formattedQuery = {
			filter: this.filter,
			sorts: this.sorts,
		};
		const database = await this.notion.queryDatabase(
			this.database_id,
			formattedQuery
		);
		return new DatabaseList(database, this.notion);
	}
}


type DatabaseListProps = {
	object: "list";
	results: any[];
}


/*
	Entry List contexted

	method provider for "Entry" class
*/
export class DatabaseList {
	constructor(
		private list: DatabaseListProps,
		private notion: NotionService
	) {}

	/*
		Data extraction operation
	*/
	async getPropertiesList(): Promise<any[]> {

		const map = await this.list;
		if (Array.isArray(map.results)) {
			const filteredList = map.results.map((item: any) => {
				const data = item.properties;
				data.id = item.id;
				return data;
			});
			return filteredList;
		} else {
			console.error("map is not an array:", map, "failed ");
			return [];
		}
	}

	/*
		Data extraction operation
	*/
	async property(property: string): Promise<any[]> {
		return (await this.getPropertiesList())[0][property]
	}

	async id(): Promise<string> {
		return (await this.getPropertiesList())[0].id;
	}

	async delete() {
		this.notion.deleteBlock(this.list.results[0].id);
	}

	async update(key: string, value: any) {
		this.notion.updateBlock(this.list.results[0].id, key, value);
	}

	/*
		entry bassed list operation
	*/
	async getPagesList(): Promise<any[]> {
		const pagesIDs: string[] = this.list.results.map((item: any) => {
			return item.id;
		});
		return Promise.all(pagesIDs.map(async (pageId: string) => {
			const page = await this.notion.getPage(pageId);
			return new Page(page, this.notion);
		}));
	}
}

export class Page {
	constructor(
		public page: any,
		private notion: NotionService,
	) {}

	async getChildrenBlocks(): Promise<NotionBlock[]> {
		const children = await this.notion.getBlockChildren(this.page.id);
		if (!children.results) throw new ConflictException({ message: "notion api data integrity logic failure" });
		return children.results;
	}
}

export const propertyExtractors: {[key:string]:(data: any)=>any} = {
	rich_text: async (data: any) => {
		return data[data.type][0].plain_text;
	},
	number: async (data: any) => {
		return data[data.type];
	}
}