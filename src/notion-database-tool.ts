import {
	Table, Properties, DataAdapterFunction
} from "./db-generics/table";
import {
	BadRequestException,
	ConflictException
} from "./exception/exceptions";
import
	NotionService
from "./api/notion.service";


export type TableProps = {
	name: string;
	database_id: string;
	properties: Properties;
}

const queryComparatorMap: {[key:string]:string} = {
	"number": "equals",
	"relation": "contains",
	"rich_text": "equals",
};

const insertMethodMap: {[key:string]:string} = {
	"number": "addNumber",
	"relation": "addRelation",
	"rich_text": "addRichText",
	"select": "addSelect",
	"url": "addUrl",
	"title": "addTitle",
};


const queryComparator = (property_type: string) => {
	const comparator = queryComparatorMap[property_type];
	if (!comparator) return "equals";
	return comparator;
};

const insertMethodSelector = (property_type: string) => {
	const method = insertMethodMap[property_type];
	if (!method) return "addTitle";
	return method;
};

export class NotionDatabaseTool {
	constructor(
		private notion_service: NotionService,
		private tables: TableProps[],
		private entryDataAdapter: DataAdapterFunction,
		private propertyExtractors: {[key:string]:(data: any)=>any},
	) {}

	getTable(name: string): Table {
		const table = this.tables.find((table) => table.name === name);
		if (!table) throw new BadRequestException("Table name is not registered");
		return new Table(
			table.database_id,
			table.properties,
			new DatabaseQueryBuilder(table.database_id, this.notion_service),
			new DatabaseEntryBuilder(table.database_id, this.notion_service),
			this.entryDataAdapter,
			queryComparator,
			insertMethodSelector,
			this.propertyExtractors
		);
	}

	notion() {
		return this.notion_service;
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
	rich_text = "rich_text",
	select = "select",
}

export class DatabaseQueryBuilder {
	private limit: number = 100;
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

	public setLimit(limit: number) {
		this.limit = limit;
		return this;
	}

	/*
		Aquire entries
	*/
	public async execute(): Promise<any> {
		this.convertFilterInfoToFilter();
		const formattedQuery: any = {};
		if (this.sorts.length > 0) {
			formattedQuery.sorts = this.sorts;
		}
		if (this.filterTokens.length > 0) {
			formattedQuery.filter = this.filter;
		}
		formattedQuery.page_size = this.limit;
		const database = await this.notion.queryDatabase(
			this.database_id,
			formattedQuery,
		);
		return database;
	}
}

export class DatabaseEntryBuilder {
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

	public addRelation(name: string, relation: string[]) {
		if (!relation) return this;
		this.properties[name] = {
			relation: relation.map((id) => {
				return {
					id: id,
				};
			}),
		};
		return this;
	}

	public addSelect(name: string, select: string) {
		this.properties[name] = {
			select: {
				name: select,
			},
		};
		return this;
	}

	public async execute(): Promise<any> {
		const formattedProperties = {
			parent: { database_id: this.database_id },
			properties: this.properties,
		};
		return await this.notion.createPage(formattedProperties);
	}
}
