import { AwsSimpleQueue } from '@src/core/application/ports/output/awsSimpleQueue';
import { SQSClient, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
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
}