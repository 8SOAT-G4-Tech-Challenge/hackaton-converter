import { ConvertionNotificationDto } from '@application/dtos/convertionNotificationDto';
import {
	ConvertionStatusEnum,
	ConvertionStatusEnumType,
} from '@application/enumerations/convertionStatusEnum';
import logger from '@common/logger';
import { HackatonApi } from '@ports/output/hackatonApi';

export class HackatonService {
	private readonly hackatonApi;

	constructor(hackatonApi: HackatonApi) {
		this.hackatonApi = hackatonApi;
	}

	async sendStatusStartedConvertion(
		userId: string,
		fileId: string
	): Promise<void> {
		logger.info(
			`[CONVERTER SERVICE] Sending status of conversation started to user ${userId}`
		);
		const convertionNotificationDto = new ConvertionNotificationDto({
			status: ConvertionStatusEnum.processing,
			fileId,
			userId,
		});
		await this.hackatonApi.sendNotification(convertionNotificationDto);
	}

	async sendStatusErrorConvertion(
		userId: string,
		fileId: string
	): Promise<void> {
		logger.info(
			`[CONVERTER SERVICE] Sending status of conversation error to user ${userId}`
		);
		const convertionNotificationDto = new ConvertionNotificationDto({
			status: ConvertionStatusEnum.error as ConvertionStatusEnumType,
			fileId,
			userId,
		});
		await this.hackatonApi.sendNotification(convertionNotificationDto);
	}

	async sendStatusFinishedConvertion(
		compressedFileKey: string,
		userId: string,
		fileId: string
	): Promise<void> {
		logger.info(
			`[CONVERTER SERVICE] Sending status of conversation finished to user ${userId} with ${compressedFileKey}`
		);
		const convertionNotificationDto = new ConvertionNotificationDto({
			status: ConvertionStatusEnum.processed,
			fileId,
			userId,
			compressedFileKey,
		});
		await this.hackatonApi.sendNotification(convertionNotificationDto);
	}
}
