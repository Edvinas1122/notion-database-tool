export type Property = {
	property: string;
	property_type: string;
}
export type Properties = {
	key: Property;
	properties: Property[];
}

type QueryInitateProps = {
	// database_id: string;
	property_name: string;
	property_type: string;
	filter_condition: string;
	value: any;
}

export type DataAdapterFunction = (data: any) => any;

// type QueryAdapterFunction = (query: any, queryInitateProps: QueryInitateProps | InsertQueryInitateProps) => any;
type QueryAdapterFunction = (query: any, queryInitateProps: any) => any;

/*
	Provides adapter for filter on a single entity extraction
*/
type queryComparator = (property_type: string) => string

class EntryExtractor {
	[key: string]: any;
	constructor(
		// private id: string,
		properties: Properties,
		private extractionQuery: any,
		private dataAdapter: DataAdapterFunction,
		private queryComparator: string,
		private propertyExtractors: {[key:string]:(data: any)=>any},
		// private extractQueryAdapter: QueryAdapterFunction
	){
		this["byKey"] = this.assignExtractor(properties.key);
		for (const property of properties.properties) {
			const methodName: string = "by" + property.property.replace(/\s+/g, '_');
			this[methodName] = this.assignExtractor(property);
			console.log(methodName);
		}
	}

	private assignExtractor(property: Property): (key: string) => Promise<Entry>
	{
		return async (value: string) => {
			const filtered = this
				.extractionQuery
				.addFilter(
					property.property,
					property.property_type,
					this.queryComparator,
					value)
				.execute();
			return filtered.then((data: any) => (new Entry(
				this.dataAdapter(data),
				this.propertyExtractors[property.property_type],
			)));
		}
	}
}

type InsertQueryInitateProps = Omit<QueryInitateProps, 'filter_condition'>;

class EntrySlot {
	constructor(
		private properties: Properties,
		private insertionQuery: any,
		private insertQueryAdapter: QueryAdapterFunction,
	) { }

	// Instead of dynamically creating methods, we're just handling the logic here
	public async insert(data: any): Promise<any> {
		for (const property of this.properties.properties) {
			this.insertQueryAdapter(this.insertionQuery, {
				property_name: property.property,
				property_type: property.property_type,
				value: data[property.property],
			});
		}
		return await this.execute();
	}

	private async execute(): Promise<void> {
		return await this.insertionQuery.execute();
	}
}


export class Table
{
	constructor(
		private id: string,
		private properties: Properties,
		private extractionQuery: any,
		private insertionQuery: any,
		private dataAdapter: DataAdapterFunction = (data: any) => data,
		private defaultComparator: queryComparator = (property_type: string) => property_type,
		private insertMethodSelector: queryComparator = (property_type: string) => property_type,
		private propertyExtractors: {[key: string]: (data: any) => any} = {},
		private insertQueryAdapter: QueryAdapterFunction = (insertionQuery: any, queryInitateProps: InsertQueryInitateProps) => {
			const pickedMethodName: string = this.insertMethodSelector(queryInitateProps.property_type);
			insertionQuery[pickedMethodName](queryInitateProps.property_name, queryInitateProps.value);
		},
	){}

	getEntries(
		comperor?: string,
	): EntryExtractor
	{
		return new EntryExtractor(
			// this.id,
			this.properties,
			this.extractionQuery,
			this.dataAdapter,
			comperor ? comperor : this.defaultComparator(this.properties.key.property_type),
			this.propertyExtractors
		);
	}

	newEntrySlot(): EntrySlot
	{
		return new EntrySlot(
			this.properties,
			this.insertionQuery,
			this.insertQueryAdapter,
		);
	}
}

type CellValue = any;

class Entry {
	constructor(
		private methodProvider: any,
		private dataAdapter: (data: any) => CellValue = (data: any) => data,
	) {}

	async property(key: string): Promise<any> {
		if (!this.dataAdapter) this.dataAdapter = (data: any) => data;
		return await this.methodProvider.property(key).then(this.dataAdapter);
	}

	async id(): Promise<string> {
		return await this.methodProvider.id();
	}

	async update(key: string, value: any): Promise<any> {
		return await this.methodProvider.editProperty(key, value);
	}

	async delete(): Promise<any> {
		return await this.methodProvider.delete();
	}
}