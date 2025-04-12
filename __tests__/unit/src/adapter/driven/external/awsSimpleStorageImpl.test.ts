import {
	DeleteObjectCommand,
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

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

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

		console.log = jest.fn();
		console.error = jest.fn();

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
		console.log = originalConsoleLog;
		console.error = originalConsoleError;
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
			mockSendPut = jest.fn();
			// Re-mock S3Client para uploadFile
			(S3Client as jest.Mock).mockImplementation(() => ({
				send: mockSendPut,
			}));

			awsSimpleStorage = new AwsSimpleStorageImpl();
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

	describe('deleteFile', () => {
		let mockSendDelete: jest.Mock;

		beforeEach(() => {
			mockSendDelete = jest.fn();
			// Re-mock S3Client para deleteFile
			(S3Client as jest.Mock).mockImplementation(() => ({
				send: mockSendDelete,
			}));

			awsSimpleStorage = new AwsSimpleStorageImpl();
		});

		it('should call DeleteObjectCommand with correct parameters', async () => {
			// Arrange
			const key = 'test-file.zip';
			mockSendDelete.mockResolvedValue({});

			// Act
			await awsSimpleStorage.deleteFile(key);

			// Assert
			expect(S3Client).toHaveBeenCalledWith({ region: 'us-east-1' });
			expect(DeleteObjectCommand).toHaveBeenCalledWith({
				Bucket: 'test-bucket',
				Key: key,
			});
			expect(mockSendDelete).toHaveBeenCalledTimes(1);
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining(
					`Arquivo ${key} deletado do bucket test-bucket`,
				),
			);
		});

		it('should handle error without throwing when deleting file fails', async () => {
			// Arrange
			const key = 'test-file.zip';
			const errorMessage = 'Error deleting file';
			const testError = new Error(errorMessage);
			mockSendDelete.mockRejectedValue(testError);

			// Act - Como o método encapsula os erros, não devemos ter exceção
			const result = await awsSimpleStorage.deleteFile(key);

			// Assert
			expect(result).toBeUndefined(); // Método retorna void
			expect(DeleteObjectCommand).toHaveBeenCalledWith({
				Bucket: 'test-bucket',
				Key: key,
			});
			expect(mockSendDelete).toHaveBeenCalledTimes(1);
			expect(console.error).toHaveBeenCalledWith(
				expect.stringContaining(`Erro ao deletar arquivo ${key} do bucket:`),
				testError,
			);
			// Não deve chamar o log de sucesso
			expect(console.log).not.toHaveBeenCalled();
		});

		it('should use the exact key provided without modification', async () => {
			// Arrange
			const key = 'path/to/user/images/file.zip';
			mockSendDelete.mockResolvedValue({});

			// Act
			await awsSimpleStorage.deleteFile(key);

			// Assert
			expect(DeleteObjectCommand).toHaveBeenCalledWith(
				expect.objectContaining({
					Key: 'path/to/user/images/file.zip',
				}),
			);
		});
	});
});
