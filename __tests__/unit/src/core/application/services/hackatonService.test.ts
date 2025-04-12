import { ConvertionNotificationDto } from '@application/dtos/convertionNotificationDto';
import {
	ConvertionStatusEnum,
	ConvertionStatusEnumType,
} from '@application/enumerations/convertionStatusEnum';
import { HackatonApi } from '@ports/output/hackatonApi';
import { HackatonService } from '@services/hackatonService';

// Mock implementation of the HackatonApi port
const createMockHackatonApi = (): jest.Mocked<HackatonApi> => ({
	sendNotification: jest.fn().mockResolvedValue(undefined),
});

describe('HackatonService', () => {
	let hackatonService: HackatonService;
	let mockHackatonApi: jest.Mocked<HackatonApi>;

	beforeEach(() => {
		// Create fresh mocks for each test
		mockHackatonApi = createMockHackatonApi();
		hackatonService = new HackatonService(mockHackatonApi);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('sendStatusStartedConvertion', () => {
		it('should send a processing status notification', async () => {
			// Arrange
			const userId = 'test-user-id';
			const fileId = 'test-file-id';
			const expectedDto = new ConvertionNotificationDto({
				status: ConvertionStatusEnum.processing as ConvertionStatusEnumType,
				userId: 'test-user-id',
				fileId: 'test-file-id',
			});

			// Act
			await hackatonService.sendStatusStartedConvertion(userId, fileId);

			// Assert
			expect(mockHackatonApi.sendNotification).toHaveBeenCalledTimes(1);
			expect(mockHackatonApi.sendNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					status: expectedDto.status,
					userId: expectedDto.userId,
					fileId: expectedDto.fileId,
				}),
			);
		});
	});

	describe('sendStatusErrorConvertion', () => {
		it('should send an error status notification', async () => {
			// Arrange
			const userId = 'test-user-id';
			const fileId = 'test-file-id';
			const expectedDto = new ConvertionNotificationDto({
				status: ConvertionStatusEnum.error as ConvertionStatusEnumType,
				userId: 'test-user-id',
				fileId: 'test-file-id',
			});

			// Act
			await hackatonService.sendStatusErrorConvertion(userId, fileId);

			// Assert
			expect(mockHackatonApi.sendNotification).toHaveBeenCalledTimes(1);
			expect(mockHackatonApi.sendNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					status: expectedDto.status,
					userId: expectedDto.userId,
					fileId: expectedDto.fileId,
				}),
			);
		});
	});

	describe('sendStatusFinishedConvertion', () => {
		it('should send a finished status notification with the compressed file key', async () => {
			// Arrange
			const userId = 'test-user-id';
			const compressedFileKey = 'test-compressed-file.zip';
			const fileId = 'test-file-id';

			const expectedDto = new ConvertionNotificationDto({
				status: ConvertionStatusEnum.processed as ConvertionStatusEnumType,
				userId: 'test-user-id',
				fileId: 'test-file-id',
				compressedFileKey: 'test-compressed-file.zip',
			});

			// Act
			await hackatonService.sendStatusFinishedConvertion(
				compressedFileKey,
				userId,
				fileId
			);

			// Assert
			expect(mockHackatonApi.sendNotification).toHaveBeenCalledTimes(1);
			expect(mockHackatonApi.sendNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					status: expectedDto.status,
					userId: expectedDto.userId,
					fileId: expectedDto.fileId,
					compressedFileKey: expectedDto.compressedFileKey,
				}),
			);
		});
	});
});
