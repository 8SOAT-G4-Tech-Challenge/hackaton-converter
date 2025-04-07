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
		it('should send a started status notification', async () => {
			// Arrange
			const userId = 'test-user-id';
			const expectedDto = new ConvertionNotificationDto(
				ConvertionStatusEnum.started as ConvertionStatusEnumType,
				userId,
			);

			// Act
			await hackatonService.sendStatusStartedConvertion(userId);

			// Assert
			expect(mockHackatonApi.sendNotification).toHaveBeenCalledTimes(1);
			expect(mockHackatonApi.sendNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					status: expectedDto.status,
					userId: expectedDto.userId,
				}),
			);
		});
	});

	describe('sendStatusErrorConvertion', () => {
		it('should send an error status notification', async () => {
			// Arrange
			const userId = 'test-user-id';
			const expectedDto = new ConvertionNotificationDto(
				ConvertionStatusEnum.error as ConvertionStatusEnumType,
				userId,
			);

			// Act
			await hackatonService.sendStatusErrorConvertion(userId);

			// Assert
			expect(mockHackatonApi.sendNotification).toHaveBeenCalledTimes(1);
			expect(mockHackatonApi.sendNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					status: expectedDto.status,
					userId: expectedDto.userId,
				}),
			);
		});
	});

	describe('sendStatusFinishedConvertion', () => {
		it('should send a finished status notification with the compressed file key', async () => {
			// Arrange
			const userId = 'test-user-id';
			const compressedFileKey = 'test-compressed-file.zip';
			const expectedDto = new ConvertionNotificationDto(
				ConvertionStatusEnum.finished as ConvertionStatusEnumType,
				userId,
				compressedFileKey,
			);

			// Act
			await hackatonService.sendStatusFinishedConvertion(
				compressedFileKey,
				userId,
			);

			// Assert
			expect(mockHackatonApi.sendNotification).toHaveBeenCalledTimes(1);
			expect(mockHackatonApi.sendNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					status: expectedDto.status,
					userId: expectedDto.userId,
					compressedFileKey: expectedDto.compressedFileKey,
				}),
			);
		});
	});
});
