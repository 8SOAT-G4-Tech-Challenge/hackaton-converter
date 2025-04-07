import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import logger from '@common/logger';
import { AwsSimpleStorageImpl } from '@driven/external/awsSimpleStorageImpl';

// Mock do S3Client e comandos
jest.mock('@aws-sdk/client-s3');
jest.mock('@common/logger', () => ({
	info: jest.fn(),
}));

// Mock das variáveis de ambiente
const originalEnv = process.env;

describe('AwsSimpleStorageImpl', () => {
	let awsSimpleStorage: AwsSimpleStorageImpl;
	let mockSendGet: jest.Mock;
	let mockSendPut: jest.Mock;

	beforeEach(() => {
		// Configurando ambiente de teste
		process.env = {
			...originalEnv,
			AWS_REGION: 'us-east-1',
			AWS_BUCKET: 'test-bucket',
		};

		// Resetando mocks
		jest.clearAllMocks();

		// Configurando mock para o cliente S3
		mockSendGet = jest.fn();
		mockSendPut = jest.fn();

		// Mock do S3Client para getObject
		(S3Client as jest.Mock).mockImplementation(() => ({
			send: mockSendGet,
		}));

		// Instanciando o objeto que vamos testar
		awsSimpleStorage = new AwsSimpleStorageImpl();
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('getObject', () => {
		it('should create S3Client with correct region and call GetObjectCommand', async () => {
			// Arrange
			const key = 'test-file.mp4';
			const mockContent = Buffer.from('mock file content');
			const mockResponse = {
				Body: mockContent,
				ETag: 'test-etag',
				VersionId: 'test-version',
			};
			mockSendGet.mockResolvedValue(mockResponse);

			// Act
			const result = await awsSimpleStorage.getObject(key);

			// Assert
			expect(S3Client).toHaveBeenCalledWith({ region: 'us-east-1' });
			expect(GetObjectCommand).toHaveBeenCalledWith({
				Bucket: 'test-bucket',
				Key: key,
			});
			expect(mockSendGet).toHaveBeenCalledTimes(1);
			expect(result).toEqual({
				key,
				content: mockContent,
				eTag: 'test-etag',
				versionId: 'test-version',
			});
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining(`Getting object ${key}`),
			);
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining(`Successfully obtained object ${key}`),
			);
		});

		it('should handle error when getting object fails', async () => {
			// Arrange
			const key = 'test-file.mp4';
			const errorMessage = 'Error getting object';
			mockSendGet.mockRejectedValue(new Error(errorMessage));

			// Act & Assert
			await expect(awsSimpleStorage.getObject(key)).rejects.toThrow(
				errorMessage,
			);
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining(`Getting object ${key}`),
			);
			// Não deve chamar o log de sucesso
			expect(logger.info).not.toHaveBeenCalledWith(
				expect.stringContaining(`Successfully obtained object ${key}`),
			);
		});
	});

	describe('uploadFile', () => {
		beforeEach(() => {
			// Re-mock S3Client para uploadFile
			(S3Client as jest.Mock).mockImplementation(() => ({
				send: mockSendPut,
			}));
		});

		it('should create S3Client with correct region and call PutObjectCommand', async () => {
			// Arrange
			const userId = 'test-user';
			const key = 'test-file.zip';
			const fileContent = Buffer.from('test file content');
			mockSendPut.mockResolvedValue({});

			// Act
			await awsSimpleStorage.uploadFile(userId, key, fileContent);

			// Assert
			expect(S3Client).toHaveBeenCalledWith({ region: 'us-east-1' });
			expect(PutObjectCommand).toHaveBeenCalledWith({
				Bucket: 'test-bucket',
				Key: `${userId}/images/${key}`,
				Body: fileContent,
				ContentType: 'application/zip',
			});
			expect(mockSendPut).toHaveBeenCalledTimes(1);
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining(`Uploading file ${key}`),
			);
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining(`Successfully uploaded file ${key}`),
			);
		});

		it('should handle error when uploading file fails', async () => {
			// Arrange
			const userId = 'test-user';
			const key = 'test-file.zip';
			const fileContent = Buffer.from('test file content');
			const errorMessage = 'Error uploading file';
			mockSendPut.mockRejectedValue(new Error(errorMessage));

			// Act & Assert
			await expect(
				awsSimpleStorage.uploadFile(userId, key, fileContent),
			).rejects.toThrow(errorMessage);
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining(`Uploading file ${key}`),
			);
			// Não deve chamar o log de sucesso
			expect(logger.info).not.toHaveBeenCalledWith(
				expect.stringContaining(`Successfully uploaded file ${key}`),
			);
		});

		it('should correctly construct the S3 key path with userId', async () => {
			// Arrange
			const userId = 'user-123';
			const key = 'test-file.zip';
			const fileContent = Buffer.from('test file content');
			mockSendPut.mockResolvedValue({});

			// Act
			await awsSimpleStorage.uploadFile(userId, key, fileContent);

			// Assert
			expect(PutObjectCommand).toHaveBeenCalledWith(
				expect.objectContaining({
					Key: 'user-123/images/test-file.zip',
				}),
			);
		});
	});
});
