import
	NotionService
from "./api/notion.service";
import
	NotionAPI
from "./api/api";
import { 
	NotionDatabaseTool,
	TableProps
} from "./notion-database-tool";
import { 
	DatabaseList,
	propertyExtractors 
} from "./format-adapter.service";


function buildNotionDatabaseTool(
	integrationToken: string,
	serviceTables: TableProps[],
	cache?: { [key: string]: any },
): NotionDatabaseTool
{
	const notionAPI = new NotionAPI(
		integrationToken,
	);
	const notionService = new NotionService(
		notionAPI,
		cache
	);
	const databaseTool = new NotionDatabaseTool(
		notionService,
		serviceTables,
		// entry method provider
		(data: any) => new DatabaseList(
			data,
			notionService
		),
		propertyExtractors
	);
	return databaseTool;
}

export default buildNotionDatabaseTool;