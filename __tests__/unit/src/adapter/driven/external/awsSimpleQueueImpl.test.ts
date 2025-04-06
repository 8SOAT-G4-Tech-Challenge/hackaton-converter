import {
	DeleteMessageCommand,
	ReceiveMessageCommand,
	SQSClient,
} from '@aws-sdk/client-sqs';
import logger from '@common/logger';
import { AwsSimpleQueueImpl } from '@driven/external/awsSimpleQueueImpl';

// Mock do SQS e do logger
jest.mock('@aws-sdk/client-sqs');
jest.mock('@common/logger', () => ({
	info: jest.fn(),
}));

// Mock das variáveis de ambiente
const originalEnv = process.env;

describe('AwsSimpleQueueImpl', () => {
	let awsSimpleQueue: AwsSimpleQueueImpl;
	let mockSendReceive: jest.Mock;
	let mockSendDelete: jest.Mock;

	beforeEach(() => {
		// Configurando ambiente de teste
		process.env = {
			...originalEnv,
			AWS_REGION: 'us-east-1',
			AWS_SQS_REGION: 'us-east-1',
			AWS_SQS_URL: 'https://sqs.example.com/queue',
		};

		// Resetando mocks
		jest.clearAllMocks();

		// Configurando mock para o cliente SQS
		mockSendReceive = jest.fn();
		mockSendDelete = jest.fn();

		// Mock do SQSClient para receiveMessages
		(SQSClient as jest.Mock).mockImplementation(() => ({
			send: mockSendReceive,
		}));

		// Instanciando o objeto que vamos testar
		awsSimpleQueue = new AwsSimpleQueueImpl();
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('receiveMessages', () => {
		it('should create SQSClient with correct region and call ReceiveMessageCommand', async () => {
			// Arrange
			const mockResponse = {
				Messages: [
					{
						MessageId: 'test-id',
						ReceiptHandle: 'test-receipt-handle',
						Body: '{"key": "value"}',
					},
				],
			};
			mockSendReceive.mockResolvedValue(mockResponse);

			// Act
			const result = await awsSimpleQueue.receiveMessages();

			// Assert
			expect(SQSClient).toHaveBeenCalledWith({ region: 'us-east-1' });
			expect(ReceiveMessageCommand).toHaveBeenCalledWith({
				QueueUrl: 'https://sqs.example.com/queue',
				MessageAttributeNames: ['ALL'],
				MaxNumberOfMessages: 10,
				VisibilityTimeout: 20,
				WaitTimeSeconds: 0,
			});
			expect(mockSendReceive).toHaveBeenCalledTimes(1);
			expect(result).toEqual(mockResponse);
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining('Receive messages SQS'),
			);
		});

		it('should handle error when receiving messages fails', async () => {
			// Arrange
			const errorMessage = 'Error receiving messages';
			mockSendReceive.mockRejectedValue(new Error(errorMessage));

			// Act & Assert
			await expect(awsSimpleQueue.receiveMessages()).rejects.toThrow(
				errorMessage,
			);
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining('Receive messages SQS'),
			);
		});
	});

	describe('deleteMessage', () => {
		it('should create SQSClient with correct region and call DeleteMessageCommand', async () => {
			// Arrange
			const messageId = 'test-message-id';
			const receiptHandle = 'test-receipt-handle';
			mockSendDelete.mockResolvedValue({});

			// Mock SQSClient de novo para o método deleteMessage
			(SQSClient as jest.Mock).mockImplementation(() => ({
				send: mockSendDelete,
			}));

			// Act
			await awsSimpleQueue.deleteMessage(messageId, receiptHandle);

			// Assert
			expect(SQSClient).toHaveBeenCalledWith({ region: 'us-east-1' });
			expect(DeleteMessageCommand).toHaveBeenCalledWith({
				QueueUrl: 'https://sqs.example.com/queue',
				ReceiptHandle: receiptHandle,
			});
			expect(mockSendDelete).toHaveBeenCalledTimes(1);
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining(`Deleting message ${messageId}`),
			);
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining(`Message ${messageId} deleted successfully`),
			);
		});

		it('should handle error when deleting message fails', async () => {
			// Arrange
			const messageId = 'test-message-id';
			const receiptHandle = 'test-receipt-handle';
			const errorMessage = 'Error deleting message';
			mockSendDelete.mockRejectedValue(new Error(errorMessage));

			// Mock SQSClient de novo para o método deleteMessage
			(SQSClient as jest.Mock).mockImplementation(() => ({
				send: mockSendDelete,
			}));

			// Act & Assert
			await expect(
				awsSimpleQueue.deleteMessage(messageId, receiptHandle),
			).rejects.toThrow(errorMessage);
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining(`Deleting message ${messageId}`),
			);
			// Não deve chamar o log de sucesso
			expect(logger.info).not.toHaveBeenCalledWith(
				expect.stringContaining(`Message ${messageId} deleted successfully`),
			);
		});

		it('should use the correct AWS SQS region from environment variable', async () => {
			// Arrange
			process.env.AWS_SQS_REGION = 'eu-west-1'; // Alterando a região
			const messageId = 'test-message-id';
			const receiptHandle = 'test-receipt-handle';
			mockSendDelete.mockResolvedValue({});

			// Mock SQSClient de novo para o método deleteMessage
			(SQSClient as jest.Mock).mockImplementation(() => ({
				send: mockSendDelete,
			}));

			// Act
			await awsSimpleQueue.deleteMessage(messageId, receiptHandle);

			// Assert
			expect(SQSClient).toHaveBeenCalledWith({ region: 'eu-west-1' });
		});
	});
});
