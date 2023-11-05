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
	// public getDatabaseQueryBuilder(database_id: string): any {
	// 	return new DatabaseQueryBuilder(database_id, this.notion);
	// }

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
		if (!children.results) throw new ConflictException("notion api data integrity logic failure in Nested Block" );
		children.results = await this.handleSubBlocks(children.results);
		block.children = children;
		return block;
	}

	private async handleLinkedBlocks(block: NotionBlock): Promise<NotionBlock> {
		const linkedPage = await this.notion.getPage(block.id);
		if (!linkedPage?.properties) throw new ConflictException("notion api data integrity logic failure in linked Blocks");
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

	async relationMethod(page_id:string) {
		return this.giveRelationAccess(page_id);
	}

	private giveRelationAccess(page_id: string): () => Promise<any> {
		return async () => {
			const linkedPage = await this.notion.getPage(page_id);
			if (!linkedPage?.properties) {
				console.error("linkedPage is not an array:", page_id, "failed ");
				return [];
				// throw new ConflictException("notion api data integrity logic failure");
			}
			const new_item = linkedPage.properties;
			new_item.cover = linkedPage.cover;
			new_item.icon = linkedPage.icon;
			return new_item;
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

	async update(key: string, value: any, type: string) {
		const test = {
			"properties": {
				[key]: {[type]: value}
			}
		}
		return await this.notion.updatePage(this.list.results[0].id, test);
	}

	async all() {
		return await this.getPropertiesList();
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

	public constructEntry(properties: any): NotionEntry {
		return new NotionEntry(
			properties,
			this.notion,
			);
	}
}

class NotionEntry {
	[key: string]: any;
	constructor(
		properties: {[key: string]: any},
		private notion: NotionService,
	) {
		Object.assign(this, properties);
	}

	async retrievePage(): Promise<Page> {
		const page = await this.notion.getBlock(this.id);
		// return new Page(page.results, this.notion);
		return page;
	}

	/*
		does not make sence, we strip it away
		when making the entry
	*/
	async retrievePageInfo(): Promise<any> {
		const page = await this.notion.getPage(this.id);
		if (!page?.object) {
			console.error("page is not an array:", this.id, "failed ");
		}
		return page;
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

	getBlock(count: number): any {
		return this.page;
	}
}

export const propertyExtractors: {[key:string]:(data: any)=>any} = {
	rich_text: async (data: any) => {
		if (!data[data.type][0]) return null;
		return data[data.type][0].plain_text;
	},
	number: async (data: any) => {
		return data[data.type];
	},
	unique_id: async (data: any) => {
		return data[data.type].number;
	},
	title: async (data: any) => {
		if (!data[data.type][0]) return null;
		const type = data[data.type][0].type;
		return data[data.type][0][type].content;
	},
	select: async (data: any) => {
		if (!data[data.type]) return null;
		return data[data.type].name;
	},
	multi_select: async (data: any) => {
		if (!data[data.type]) return null;
		return data[data.type].map((item: any) => item.name);
	},
	date: async (data: any) => {
		if (!data[data.type]) return null;
		return data[data.type].start;
	},
	people: async (data: any) => {
		if (!data[data.type]) return null;
		return data[data.type].map((item: any) => item.person.name);
	},
	relation: async (data: any) => {
		if (!data[data.type]) return null;
		return data[data.type].map((item: any) => item.id);
	},
	formula: async (data: any) => {
		if (!data[data.type]) return null;
		return data[data.type][data[data.type].type];
	},
	url: async (data: any) => {
		if (!data[data.type]) return null;
		return data[data.type];
	},
	created_time: async (data: any) => {
		if (!data[data.type]) return null;
		return data[data.type];
	},
	status: async (data: any) => {
		if (!data[data.type]) return null;
		return data[data.type].name;
	}
}
