import { ConvertionNotificationDto } from '@application/dtos/convertionNotificationDto';

export interface HackatonApi {
	sendNotification(
		convertionNotificationDto: ConvertionNotificationDto
	): Promise<void>;
}
