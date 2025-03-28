import logger from '@common/logger';
import { AwsSimpleQueue } from "@ports/output/awsSimpleQueue";
import { MessageSqsDto } from "@application/dtos/messageSqsDto";

export class SimpleQueueService {
	private readonly awsSimpleQueue;

	constructor(awsSimpleQueue: AwsSimpleQueue) {
		this.awsSimpleQueue = awsSimpleQueue;
	}

    async getMessages(): Promise<MessageSqsDto[]> {
        logger.info('Searching messages')
        const responseJson = await this.awsSimpleQueue.receiveMessages();
        if (responseJson) {
            const response = JSON.parse(responseJson);
            return  response.Messages.flatMap((message: any) => (new MessageSqsDto(message)));
        }
        throw new Error('Error when searching messages. Null or empty response.');
    }
}