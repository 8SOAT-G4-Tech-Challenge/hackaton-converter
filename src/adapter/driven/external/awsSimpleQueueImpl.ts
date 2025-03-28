import { AwsSimpleQueue } from '@ports/output/awsSimpleQueue';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import logger from '@common/logger';

export class AwsSimpleQueueImpl implements AwsSimpleQueue {
    
    async receiveMessages(): Promise<any> {
        logger.info(`Receive messages SQS: ${process.env.AWS_SQS_URL}`);
        const client = new SQSClient({region: process.env.AWS_SQS_REGION});
        const input = {
            QueueUrl: process.env.AWS_SQS_URL,
            MessageAttributeNames: ["ALL"],
            MaxNumberOfMessages: 10,
            VisibilityTimeout: 20,
            WaitTimeSeconds: 0,
        };
        const command = new ReceiveMessageCommand(input);
        return client.send(command);
    }

    async deleteMessage(messageId: string, receiptHandle: string): Promise<void> {
        logger.info(`Deleting message ${messageId} from SQS: ${receiptHandle}`);
        const client = new SQSClient({region: process.env.AWS_SQS_REGION});
        const input = {
            QueueUrl: process.env.AWS_SQS_URL,
            ReceiptHandle: receiptHandle
        };
        const command = new DeleteMessageCommand(input);
        await client.send(command);
        logger.info(`Message ${messageId} deleted successfully`);
    }
}