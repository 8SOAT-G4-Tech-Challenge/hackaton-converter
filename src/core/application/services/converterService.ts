import logger from '@common/logger';
import { SimpleQueueService } from '@services/simpleQueueService'

export class ConverterService {
	private readonly simpleQueueService;

	constructor(simpleQueueService: SimpleQueueService) {
		this.simpleQueueService = simpleQueueService;
	}

	async convertVideos(): Promise<void> {
		logger.info(`[CONVERTER SERVICE] Starting video conversion}`);

	}
}
