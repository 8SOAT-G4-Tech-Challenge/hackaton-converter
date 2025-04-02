import { ConvertionNotificationDto } from '@application/dtos/convertionNotificationDto';
import { ConvertionStatusEnum } from '@application/enumerations/convertionStatusEnum';
import logger from '@common/logger';
import { HackatonApi } from '@ports/output/hackatonApi';

export class HackatonService {
	private readonly hackatonApi;

	constructor(hackatonApi: HackatonApi) {
		this.hackatonApi = hackatonApi;
	}

	async sendStatusStartedConvertion(userId: string) {
		logger.info(`Sending status of conversation started to user ${userId}`);
		const convertionNotificationDto = new ConvertionNotificationDto(
			ConvertionStatusEnum.started,
			userId
		);
		this.hackatonApi.sendNotification(convertionNotificationDto);
	}

	async sendStatusFinishedConvertion(images: string[], userId: string) {
		logger.info(`Sending status of conversation finished to user ${userId} with ${images.length} images`);
		const convertionNotificationDto = new ConvertionNotificationDto(
			ConvertionStatusEnum.finished,
			userId,
			images
		);
		this.hackatonApi.sendNotification(convertionNotificationDto);
	}
}
