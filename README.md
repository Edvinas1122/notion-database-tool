# Notion Database tool

## About

A database tool lets simplified interaction with your notion tables. Provides extraction / insertion.

## Use

### Note your table “database” properties

In a configuration, note your table aka database properties.

NOTE: more properties supported in development of this module.

```tsx
const tables = [{
		name: "Share Timestamps",
		database_id: "your-database-id-passed-from-ENV",
		properties: {
			key: {
				property: "Title",
				property_type: "rich_text",
			},
			properties: [{
				property: "Holder",
				property_type: "relation",
			},{
				property: "Bicycles",
				property_type: "relation",
			},{
				property: "Share Started (UNIX)",
				property_type: "number",
			},{
				property: "Returned On (UNIX)",
				property_type: "number",
			},{
				property: "Intended Duration",
				property_type: "select",
			}
		]}
	}];
```

### Construct

Use your notion integration token from

[https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)

```tsx
const databaseTool = buildNotionDatabaseTool(
		/*
			get your integration token from
			https://www.notion.so/my-integrations
		*/
		"your-notion-integration-token",
		tables,
	);
```

### Use auto generated methods

Extract

```tsx
const bicycle_entry_id = await databaseTool
		.getTable("Share Timestamps")
		.getEntries()
		.byIntended_Duration("short")
		.then((entry: any) => entry.property("Holder"));
```

Insert

```tsx
const response = await databaseTool
		.getTable("Share Timestamps")
		.newEntrySlot()
		.insert({
			Holder: [user_entry_id],
			Bicycles: [bicycle_entry_id],
			"Share Started (UNIX)": unixTimestamp,
			"Returned On (UNIX)": 0,
			"Intended Duration": "long",
		})
```

## Contribute

If you interested don’t be shy to contact on X, I don’t bite, would assist your worthy idea on a call via Discord… as long as you are either smart or handsome.

### Idea

Map Tables in traditional database style, make intuitive ORM so table would give use ways to retrieve Entries an interactive ORM object, with methods to modify, retrieve, delete… etc.

```tsx
type CellValue = any;

class Entry {
	constructor(
		private methodProvider: any, // contains data
		private dataAdapter: (data: any) => CellValue = (data: any) => data,
	) {}

	async property(key: string): Promise<any> {
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
```

Therefore, keeping interaction with our notion api consistent ant coherent.


