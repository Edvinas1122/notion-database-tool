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
		private properties: Properties,
		private extractionQuery: any,
		private dataAdapter: DataAdapterFunction,
		private queryComparator: string,
		private propertyExtractors: {[key:string]:(data: any)=>any},
		private sort?: {[key:string]:string},
		private limit: number = 100,
		// private extractQueryAdapter: QueryAdapterFunction
	){
		this["byKey"] = this.assignExtractor(this.properties.key);
		for (const property of properties.properties) {
			const methodName: string = "by" + property.property.replace(/\s+/g, '_');
			this[methodName] = this.assignExtractor(property);
			// console.log(methodName);
		}
	}

	public async all(): Promise<Entry> {
		return await this.extractionQuery.execute()
			.then((data: any) => (new Entry(
				this.dataAdapter(data),
				this.propertyExtractors,
				""
			)));
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
				.setLimit(this.limit)
				.execute();
			return filtered.then((data: any) => (new Entry(
				this.dataAdapter(data),
				this.propertyExtractors,
				property.property_type,
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
		sort?: {[key:string]:string}
	): EntryExtractor
	{
		return new EntryExtractor(
			// this.id,
			this.properties,
			this.extractionQuery,
			this.dataAdapter,
			comperor ? comperor : this.defaultComparator(this.properties.key.property_type),
			this.propertyExtractors,
			sort,
		);
	}

	getEntry(
		id: string,
		comperor?: string,
		sort?: {[key:string]:string}
	): EntryExtractor
	{
		return new EntryExtractor(
			// this.id,
			this.properties,
			this.extractionQuery,
			this.dataAdapter,
			comperor ? comperor : this.defaultComparator(this.properties.key.property_type),
			this.propertyExtractors,
			sort,
			1
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

	query() {
		return new Query(
			this.extractionQuery,
			this.dataAdapter,
			this.propertyExtractors,
		);
	}
}

type CellValue = any;

class Entry {
	constructor(
		private methodProvider: any,
		private propertyExtractors: {[key: string]: (data: any) => any},
		private key: string = "",
		// private dataAdapter: (data: any) => CellValue = (data: any) => data,
	) {

	}

	async property(key: string): Promise<any> {
		// if (!this.dataAdapter) this.dataAdapter = (data: any) => data;
		return await this.methodProvider.property(key)
			.then(this.propertyExtractors[this.key] ? this.propertyExtractors[this.key] : (data: any) => data);
	}

	async id(): Promise<string> {
		return await this.methodProvider.id();
	}

	async update(key: string, value: any): Promise<any> {
		return await this.methodProvider.editProperty(key, value);
	}

	async all(): Promise<Single[]> {
		const data = await this.methodProvider.all();
		const extractedData = await Promise
			.all(data
				.map(this.extractItemProperties.bind(this))
			);
		return extractedData;
		// .map(properties => properties);
		//  new Single(
		// 	properties,
		// 	this.methodProvider,
		// 	this.propertyExtractors,
		// ));
	}
	
	async delete(): Promise<any> {
		return await this.methodProvider.delete();
	}

	private async extractItemProperties(item: any): Promise<any> {
		let extracted: any = {};

		const extractionPromises = Object.entries(item)
			.map(async ([key, value]: any) => {
				const extract = this.propertyExtractors[value.type];
				if (extract) {
					extracted[key] = await extract(value);
					if (value.type === "relation") {
						const relationExtractors = extracted[key].map((relationId: string) => {
							const relationMethod = this.methodProvider.relationMethod(relationId);
							return this.handleRelationAquisition(relationMethod);
						});
						extracted[key] = relationExtractors;
					}
				} else {
					extracted[key] = value;
				}
			});

		await Promise.all(extractionPromises);
		return this.methodProvider.constructEntry(extracted);
	}

	private handleRelationAquisition(
		relationMethodPromise: Promise<()=>Promise<any>>
	): () => Promise<any> {

		return async () => {
				const relation = await relationMethodPromise;
				const relationData = await relation();
				const parserdData  = await this.extractItemProperties(relationData);
				return parserdData;
		}
	}
}

class Single {
    [key: string]: any;

    constructor(
		properties: { [key: string]: string },
		private methodProvider: any,
		private propertyExtractors: { [key: string]: (data: any) => any },
    ) {
        Object.assign(this, properties);
    }

	async relation() {
		return await this.methodProvider.relation();
	}
}

class Query {
	constructor(
		private extractionQuery: any,
		private dataAdapter: any,
		private propertyExtractors: {[key:string]:(data: any)=>any},
	) {}

	filter(property: string, condition: string, comperor: string, value: any) {
		// throw new Error("Method not implemented.");
		this.extractionQuery.addFilter(property, condition, comperor, value);
		return this;
	}

	sort(property: string, direction: string) {
		this.extractionQuery.addSort(property, direction);
		return this;
	}

	limit(limit: number) {
		this.extractionQuery.setLimit(limit);
		return this;
	}

	and() {
		this.extractionQuery.and();
		return this;
	}

	or() {
		this.extractionQuery.or();
		return this;
	}

	async get() {
		const data = await this.extractionQuery.execute();
		return new Entry(
			this.dataAdapter(data),
			this.propertyExtractors,
		);
	}
}
