import { MessageSqsDto } from '@application/dtos/messageSqsDto';
import logger from '@common/logger';
import { AwsSimpleQueue } from '@ports/output/awsSimpleQueue';

export class SimpleQueueService {
	private readonly awsSimpleQueue;

	constructor(awsSimpleQueue: AwsSimpleQueue) {
		this.awsSimpleQueue = awsSimpleQueue;
	}

	async getMessages(): Promise<MessageSqsDto[]> {
		logger.info('[CONVERTER SERVICE] Searching messages');
		const response = await this.awsSimpleQueue.receiveMessages();
		if (response && response.Messages) {
			const messages = response.Messages.map(
				(message: any) => new MessageSqsDto(message)
			);
			return messages;
		}
		throw new Error(
			'[CONVERTER SERVICE] Error when searching messages. Null or empty response.'
		);
	}

	async deleteMenssage(
		messageId: string,
		receiptHandle: string
	): Promise<void> {
		return this.awsSimpleQueue.deleteMessage(messageId, receiptHandle);
	}
}
