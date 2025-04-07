import * as fs from 'fs';

import { AwsSimpleStorage } from '@ports/output/awsSimpleStorage';
import { SimpleStorageService } from '@services/simpleStorageService';

// Mock fs module
jest.mock('fs', () => ({
	readFileSync: jest.fn(),
}));

// Mock implementation for AWS S3
const createMockAwsSimpleStorage = (): jest.Mocked<AwsSimpleStorage> => ({
	getObject: jest.fn(),
	uploadFile: jest.fn().mockResolvedValue(undefined),
});

describe('SimpleStorageService', () => {
	let simpleStorageService: SimpleStorageService;
	let mockAwsSimpleStorage: jest.Mocked<AwsSimpleStorage>;

	beforeEach(() => {
		mockAwsSimpleStorage = createMockAwsSimpleStorage();
		simpleStorageService = new SimpleStorageService(mockAwsSimpleStorage);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('getVideo', () => {
		it('should call AWS S3 getObject with the provided key', async () => {
			// Arrange
			const key = 'test-video-key';
			const mockResponse = { content: 'test-content' };
			mockAwsSimpleStorage.getObject.mockResolvedValue(mockResponse);

			// Act
			const result = await simpleStorageService.getVideo(key);

			// Assert
			expect(mockAwsSimpleStorage.getObject).toHaveBeenCalledTimes(1);
			expect(mockAwsSimpleStorage.getObject).toHaveBeenCalledWith(key);
			expect(result).toBe(mockResponse);
		});
	});

	describe('uploadCompressedFile', () => {
		it('should read file and upload it to S3 with the correct parameters', async () => {
			// Arrange
			const userId = 'test-user-id';
			const filePath = '/tmp/hackaton-converter/test-file.zip';
			const fileContent = Buffer.from('test-file-content');
			(fs.readFileSync as jest.Mock).mockReturnValue(fileContent);

			// Act
			const result = await simpleStorageService.uploadCompressedFile(
				userId,
				filePath,
			);

			// Assert
			expect(fs.readFileSync).toHaveBeenCalledWith(filePath);
			expect(mockAwsSimpleStorage.uploadFile).toHaveBeenCalledTimes(1);
			expect(mockAwsSimpleStorage.uploadFile).toHaveBeenCalledWith(
				userId,
				filePath,
				fileContent,
			);
			expect(result).toBe(filePath);
		});

		it('should handle paths with forward slashes correctly', async () => {
			// Arrange
			const userId = 'test-user-id';
			const filePath = '/tmp/hackaton-converter/test-file.zip';
			const fileContent = Buffer.from('test-file-content');
			(fs.readFileSync as jest.Mock).mockReturnValue(fileContent);

			// Act
			const result = await simpleStorageService.uploadCompressedFile(
				userId,
				filePath,
			);

			// Assert
			expect(mockAwsSimpleStorage.uploadFile).toHaveBeenCalledWith(
				userId,
				filePath,
				fileContent,
			);
			expect(result).toBe(filePath);
		});
	});
});
