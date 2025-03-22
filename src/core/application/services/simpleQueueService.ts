import logger from '@common/logger';
import { AwsSimpleQueue } from "../ports/output/awsSimpleQueue";

export class SimpleQueueService {
	private readonly awsSimpleQueue;

	constructor(awsSimpleQueue: AwsSimpleQueue) {
		this.awsSimpleQueue = awsSimpleQueue;
	}

    async getVideos(): Promise<void> {
        logger.info('Searching videos')
        this.awsSimpleQueue.receiveMessages();
        
    }
}