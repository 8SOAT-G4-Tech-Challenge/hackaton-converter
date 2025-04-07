import { MessageSqsDto } from '@application/dtos/messageSqsDto';
import { AwsSimpleQueue } from '@ports/output/awsSimpleQueue';
import { SimpleQueueService } from '@services/simpleQueueService';

// Mock implementation for AWS SQS
const createMockAwsSimpleQueue = (): jest.Mocked<AwsSimpleQueue> => ({
	receiveMessages: jest.fn(),
	deleteMessage: jest.fn().mockResolvedValue(undefined),
});

describe('SimpleQueueService', () => {
	let simpleQueueService: SimpleQueueService;
	let mockAwsSimpleQueue: jest.Mocked<AwsSimpleQueue>;

	beforeEach(() => {
		mockAwsSimpleQueue = createMockAwsSimpleQueue();
		simpleQueueService = new SimpleQueueService(mockAwsSimpleQueue);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('getMessages', () => {
		it('should return messages when SQS returns valid messages', async () => {
			// Arrange
			const mockSqsMessages = {
				Messages: [
					{
						MessageId: 'test-message-id',
						ReceiptHandle: 'test-receipt-handle',
						Body: JSON.stringify({
							fileName: 'test-video.mp4',
							fileStorageKey: 'test-storage-key',
							userId: 'test-user-id',
						}),
					},
				],
			};
			mockAwsSimpleQueue.receiveMessages.mockResolvedValue(mockSqsMessages);

			// Act
			const result = await simpleQueueService.getMessages();

			// Assert
			expect(mockAwsSimpleQueue.receiveMessages).toHaveBeenCalledTimes(1);
			expect(result).toHaveLength(1);
			expect(result[0]).toBeInstanceOf(MessageSqsDto);
			expect(result[0].id).toBe('test-message-id');
			expect(result[0].receiptHandle).toBe('test-receipt-handle');
			expect(result[0].body).toEqual(
				expect.objectContaining({
					fileName: 'test-video.mp4',
					fileStorageKey: 'test-storage-key',
					userId: 'test-user-id',
				}),
			);
		});

		it('should throw an error when SQS returns no messages', async () => {
			// Arrange
			mockAwsSimpleQueue.receiveMessages.mockResolvedValue({});

			// Act & Assert
			await expect(simpleQueueService.getMessages()).rejects.toThrow(
				'[CONVERTER SERVICE] Error when searching messages. Null or empty response.',
			);
		});
	});

	describe('deleteMenssage', () => {
		it('should call AWS SQS deleteMessage with correct parameters', async () => {
			// Arrange
			const messageId = 'test-message-id';
			const receiptHandle = 'test-receipt-handle';

			// Act
			await simpleQueueService.deleteMenssage(messageId, receiptHandle);

			// Assert
			expect(mockAwsSimpleQueue.deleteMessage).toHaveBeenCalledTimes(1);
			expect(mockAwsSimpleQueue.deleteMessage).toHaveBeenCalledWith(
				messageId,
				receiptHandle,
			);
		});
	});
});
