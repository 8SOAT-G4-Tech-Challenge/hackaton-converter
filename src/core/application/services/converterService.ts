import logger from '@common/logger';
import { SimpleQueueService } from '@services/simpleQueueService'
import { MessageSqsDto } from '@application/dtos/messageSqsDto';

export class ConverterService {
	private readonly simpleQueueService;

	constructor(simpleQueueService: SimpleQueueService) {
		this.simpleQueueService = simpleQueueService;
	}

	async convertVideos(): Promise<void> {
		logger.info(`[CONVERTER SERVICE] Starting video conversion}`);
		const messages: MessageSqsDto[] = await this.simpleQueueService.getMessages();
		logger.info('Messages', messages)
	}
}
