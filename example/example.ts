import 
	buildNotionDatabaseTool, { 
	TableProps
} from "@edvinas1122/notion-database-tool";


/*
	An example of how to use the NotionDatabaseTool
	this method inserts a new entry into the "Share Timestamps"
	"table" aka "database" in Notion.

	Note: this is a very specific example, but it should give you
	an idea of how to use the tool.
*/
async function ourExampleMethod() {

	/*
		constuct the database tool
	*/
	const databaseTool = buildNotionDatabaseTool(
		/*
			get your integration token from
			https://www.notion.so/my-integrations
		*/
		"your-notion-integration-token",
		/*
			See the "define your notion tables" section below
		*/
		yourNotionTables(),
	);

	// timestamp for a new entry into a "table or database"
	const unixTimestamp = new Date().getTime();

	/*
		get an entry id, which needed for relation properties
		it is a "page id".
	*/
	const bicycle_entry_id = await databaseTool
		.getTable("Bicycles")
		.getEntries("equals")
		.byKey(10)
		.then((entry: any) => entry.id());
	const user_entry_id = await databaseTool
		.getTable("SignedUp")
		.getEntries("equals")
		.byIntraID(42)
		.then((entry: any) => entry.id());

	/*
		insert a new entry into the "Share Timestamps"
		table aka database


	*/
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
	return response;
}


/*
	define your notion tables
*/
const yourNotionTables = (): TableProps[] => [
	{
		name: "Bicycles",
		/*
			find when you open your table aka database in notion
			on the url bar end you will see something like this:
			https://www.notion.so/your-workspace-name/your-"database"-url?v=...
		*/
		database_id: "your-database-id-passed-from-ENV",
		properties: {
			key: {
				property: "ID",
				property_type: "number",
			},
			properties: [{
					property: "Name",
					property_type: "rich_text",
				},{
					property: "ID",
					property_type: "number",
				},{
					property: "Locker",
					property_type: "number",
				}, {
					property: "Disabled Reason",
					property_type: "rich_text",
				}, {
					property: "Availability",
					property_type: "select",
				}
			]}
	},
	{
		name: "Share Timestamps",
		database_id: "your-database-id-passed-from-ENV",
		properties: {
			key: {
				property: "empty",
				property_type: "empty",
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
	},
	{
		name: "SignedUp",
		database_id: "your-database-id-passed-from-ENV",
		properties: {
			key: {
				property: "IntraName",
				property_type: "rich_text",
			},
			properties: [{
				property: "Name",
				property_type: "rich_text",
			},{
				property: "ProfileImage",
				property_type: "rich_text",
			},{
				property: "IntraID",
				property_type: "number",
			}
		]}
	},
]