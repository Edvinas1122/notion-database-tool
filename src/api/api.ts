import API from '@edvinas1122/api_wrapper';
import { notionAPIConfig, NotionEndpoints } from './notion.conf';

export default class NotionAPI extends API<NotionEndpoints> {
	constructor(token?: string, rootPageId?: string) {
		if (!token) throw new Error("No token provided");
		// else if (!rootPageId) throw new Error("No root page id provided");
		const config = notionAPIConfig(token);
		super(config);
	}
}