import {
	SQSClient,
	ReceiveMessageCommand,
	DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import logger from '@common/logger';
import { AwsSimpleQueue } from '@ports/output/awsSimpleQueue';

export class AwsSimpleQueueImpl implements AwsSimpleQueue {
	private client = new SQSClient({ region: process.env.AWS_REGION });

	async receiveMessages(): Promise<any> {
		logger.info(
			`[CONVERTER SERVICE] Receive messages SQS: ${process.env.AWS_SQS_URL}`
		);
		const input = {
			QueueUrl: process.env.AWS_SQS_URL,
			MessageAttributeNames: ['ALL'],
			MaxNumberOfMessages: 10,
			WaitTimeSeconds: 0,
		};
		const command = new ReceiveMessageCommand(input);
		return this.client.send(command);
	}

	async deleteMessage(messageId: string, receiptHandle: string): Promise<void> {
		logger.info(
			`[CONVERTER SERVICE] Deleting message ${messageId} from SQS: ${receiptHandle}`
		);
		const input = {
			QueueUrl: process.env.AWS_SQS_URL,
			ReceiptHandle: receiptHandle,
		};
		const command = new DeleteMessageCommand(input);
		await this.client.send(command);
		logger.info(
			`[CONVERTER SERVICE] Message ${messageId} deleted successfully`
		);
	}
}
