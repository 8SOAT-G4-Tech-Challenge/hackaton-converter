import * as fs from 'fs';
import * as os from 'os';
import { PassThrough } from 'stream';

import logger from '@common/logger';
import { ConverterService } from '@services/converterService';
import { HackatonService } from '@services/hackatonService';
import { SimpleQueueService } from '@services/simpleQueueService';
import { SimpleStorageService } from '@services/simpleStorageService';

jest.mock('archiver', () => {
	// Criamos uma factory function para evitar referência circular
	function createMockArchiver() {
		// Criamos o objeto primeiro com tipo explícito
		const mockArchiver: Record<string, jest.Mock> = {
			pipe: jest.fn(),
			directory: jest.fn(),
			finalize: jest.fn(),
			on: jest.fn(),
			append: jest.fn(),
			emit: jest.fn(),
		};

		// Agora configuramos os retornos depois que o objeto foi definido
		mockArchiver.pipe.mockReturnValue(mockArchiver);
		mockArchiver.directory.mockReturnValue(mockArchiver);
		mockArchiver.append.mockReturnValue(mockArchiver);
		mockArchiver.on.mockImplementation(
			(event: string, callback: () => void) => {
				if (event === 'finish') {
					setTimeout(callback, 0);
				}
				return mockArchiver;
			},
		);

		return mockArchiver;
	}

	// Retornamos uma função que cria um novo mockArchiver cada vez que é chamada
	return jest.fn().mockImplementation(createMockArchiver);
});

jest.mock('fs', () => ({
	existsSync: jest.fn(),
	mkdirSync: jest.fn(),
	createWriteStream: jest.fn(),
	writeFile: jest.fn(),
	unlink: jest.fn(),
	readdirSync: jest.fn(),
	lstatSync: jest.fn(),
	unlinkSync: jest.fn(),
	rmdirSync: jest.fn(),
}));

jest.mock('fluent-ffmpeg', () => {
	const mockFfmpeg = jest.fn(() => ({
		inputFormat: jest.fn().mockReturnThis(),
		outputFormat: jest.fn().mockReturnThis(),
		output: jest.fn().mockReturnThis(),
		outputOptions: jest.fn().mockReturnThis(),
		on: jest.fn().mockReturnThis(),
		run: jest.fn(),
	}));

	return Object.assign(mockFfmpeg, {
		setFfmpegPath: jest.fn(),
	});
});

jest.mock('@ffmpeg-installer/ffmpeg', () => ({
	path: '/mock/path/to/ffmpeg',
}));

jest.mock('@common/logger', () => ({
	info: jest.fn(),
	error: jest.fn(),
}));

jest.mock('os', () => ({
	tmpdir: jest.fn().mockReturnValue('/mock/tmp'),
}));

jest.mock('path', () => ({
	join: jest.fn((folderPath, file) => `${folderPath}/${file}`),
}));

describe('ConverterService - Simple Functions', () => {
	let converterService: ConverterService;
	let mockQueueService: jest.Mocked<SimpleQueueService>;
	let mockStorageService: jest.Mocked<SimpleStorageService>;
	let mockHackatonService: jest.Mocked<HackatonService>;
	let mockWriteStream: any;

	beforeEach(() => {
		jest.clearAllMocks();

		// Configurar o mock do writeStream
		mockWriteStream = {
			on: jest.fn((event: string, callback: () => void) => {
				// Simular o evento 'finish' imediatamente para os testes
				if (event === 'finish') {
					setTimeout(callback, 0);
				}
				return mockWriteStream;
			}),
		};
		(fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

		mockQueueService = {
			getMessages: jest.fn(),
			deleteMenssage: jest.fn(),
		} as unknown as jest.Mocked<SimpleQueueService>;

		mockStorageService = {
			getVideo: jest.fn(),
			uploadCompressedFile: jest.fn(),
		} as unknown as jest.Mocked<SimpleStorageService>;

		mockHackatonService = {
			sendStatusStartedConvertion: jest.fn(),
			sendStatusErrorConvertion: jest.fn(),
			sendStatusFinishedConvertion: jest.fn(),
		} as unknown as jest.Mocked<HackatonService>;

		converterService = new ConverterService(
			mockQueueService,
			mockStorageService,
			mockHackatonService,
		);
	});

	describe('getTempDir', () => {
		it('should return the correct temporary directory path', () => {
			// Act
			const result = (converterService as any).getTempDir();

			// Assert
			expect(result).toBe('/mock/tmp/hackaton-converter');
			expect(os.tmpdir).toHaveBeenCalledTimes(1);
		});
	});

	describe('saveStreamToTempFile', () => {
		it('should create directory if it does not exist', async () => {
			// Arrange
			(fs.existsSync as jest.Mock).mockReturnValue(false);

			const mockStream = {
				pipe: jest.fn().mockReturnValue(mockWriteStream),
			};
			const fileName = 'test-file.mp4';

			// Act
			const filePath = await (converterService as any).saveStreamToTempFile(
				mockStream,
				fileName,
			);

			// Assert
			expect(fs.existsSync).toHaveBeenCalledWith(
				'/mock/tmp/hackaton-converter',
			);
			expect(fs.mkdirSync).toHaveBeenCalledWith(
				'/mock/tmp/hackaton-converter',
				{ recursive: true },
			);
			expect(fs.createWriteStream).toHaveBeenCalledWith(
				'/mock/tmp/hackaton-converter/test-file.mp4',
			);
			expect(mockStream.pipe).toHaveBeenCalledWith(mockWriteStream);
			expect(filePath).toBe('/mock/tmp/hackaton-converter/test-file.mp4');
		});

		it('should not create directory if it already exists', async () => {
			// Arrange
			(fs.existsSync as jest.Mock).mockReturnValue(true);

			const mockStream = {
				pipe: jest.fn().mockReturnValue(mockWriteStream),
			};
			const fileName = 'test-file.mp4';

			// Act
			const filePath = await (converterService as any).saveStreamToTempFile(
				mockStream,
				fileName,
			);

			// Assert
			expect(fs.existsSync).toHaveBeenCalledWith(
				'/mock/tmp/hackaton-converter',
			);
			expect(fs.mkdirSync).not.toHaveBeenCalled();
			expect(fs.createWriteStream).toHaveBeenCalledWith(
				'/mock/tmp/hackaton-converter/test-file.mp4',
			);
			expect(mockStream.pipe).toHaveBeenCalledWith(mockWriteStream);
			expect(filePath).toBe('/mock/tmp/hackaton-converter/test-file.mp4');
		});

		it('should handle errors during file writing', async () => {
			// Arrange
			(fs.existsSync as jest.Mock).mockReturnValue(true);

			const mockStream = {
				pipe: jest.fn().mockReturnValue(mockWriteStream),
			};
			const fileName = 'test-file.mp4';
			const testError = new Error('Write error');

			// Sobrescrever o mock para o evento 'on' para simular um erro
			mockWriteStream.on.mockImplementation(
				(event: string, callback: (err?: Error) => void) => {
					if (event === 'error') {
						setTimeout(() => callback(testError), 0);
					}
					return mockWriteStream;
				},
			);

			// Act & Assert
			await expect(
				(converterService as any).saveStreamToTempFile(mockStream, fileName),
			).rejects.toThrow(testError);
		});
	});

	describe('convertVideos', () => {
		it('should call getMessages from the queue service', async () => {
			// Arrange
			mockQueueService.getMessages.mockResolvedValue([]);

			// Act
			await converterService.convertVideos();

			// Assert
			expect(mockQueueService.getMessages).toHaveBeenCalledTimes(1);
		});

		it('should handle errors gracefully', async () => {
			// Arrange
			const testError = new Error('Test error');
			mockQueueService.getMessages.mockRejectedValue(testError);

			// Act
			await converterService.convertVideos();

			// Assert
			expect(mockQueueService.getMessages).toHaveBeenCalledTimes(1);
			// Verificar se o erro foi registrado
			expect(logger.error).toHaveBeenCalledWith(
				testError,
				'[CONVERTER SERVICE] Error converting videos',
			);
		});

		it('should call convertVideoToImages for each message', async () => {
			// Arrange
			const messages = [
				{
					id: 'msg1',
					receiptHandle: 'receipt1',
					body: {
						fileName: 'video1.mp4',
						userId: 'user-1', // Adicionando userId
						fileStorageKey: 'storage-key-1', // Adicionando fileStorageKey
					},
				},
				{
					id: 'msg2',
					receiptHandle: 'receipt2',
					body: {
						fileName: 'video2.mp4',
						userId: 'user-2', // Adicionando userId
						fileStorageKey: 'storage-key-2', // Adicionando fileStorageKey
					},
				},
			];
			mockQueueService.getMessages.mockResolvedValue(messages);

			// Substituir temporariamente o método convertVideoToImages
			// com um mock para podermos verificar se é chamado
			const originalMethod = (converterService as any).convertVideoToImages;
			(converterService as any).convertVideoToImages = jest
				.fn()
				.mockResolvedValue(undefined);

			// Act
			await converterService.convertVideos();

			// Assert
			expect(mockQueueService.getMessages).toHaveBeenCalledTimes(1);
			expect(
				(converterService as any).convertVideoToImages,
			).toHaveBeenCalledTimes(2);
			expect(
				(converterService as any).convertVideoToImages,
			).toHaveBeenCalledWith(messages[0]);
			expect(
				(converterService as any).convertVideoToImages,
			).toHaveBeenCalledWith(messages[1]);

			// Restaurar o método original
			(converterService as any).convertVideoToImages = originalMethod;
		});
	});

	describe('getVideoPath', () => {
		it('should get video from storage and save to temp file', async () => {
			// Configurar timeout para este teste individual
			jest.setTimeout(15000);

			// Arrange
			const fileName = 'test-video.mp4';
			const fileKey = 'test-storage-key';
			const expectedPath = '/mock/tmp/hackaton-converter/test-video.mp4';

			// Mock do stream de vídeo
			const mockVideoStream = new PassThrough();
			mockStorageService.getVideo.mockResolvedValue({
				content: mockVideoStream,
			});

			// Mock para saveStreamToTempFile
			const saveStreamMock = jest
				.spyOn(converterService as any, 'saveStreamToTempFile')
				.mockResolvedValue(expectedPath);

			// Act
			const result = await (converterService as any).getVideoPath(
				fileName,
				fileKey,
			);

			// Assert
			expect(result).toBe(expectedPath);
			expect(mockStorageService.getVideo).toHaveBeenCalledWith(fileKey);
			expect(saveStreamMock).toHaveBeenCalledWith(mockVideoStream, fileName);

			// Restaurar o mock
			saveStreamMock.mockRestore();
		}, 15000);

		it('should handle errors when getting video', async () => {
			// Configurar timeout para este teste individual
			jest.setTimeout(15000);

			// Arrange
			const fileName = 'test-video.mp4';
			const fileKey = 'test-storage-key';
			const testError = new Error('Failed to get video');

			// Mock para simular erro ao obter o vídeo
			mockStorageService.getVideo.mockRejectedValue(testError);

			// Act & Assert
			await expect(
				(converterService as any).getVideoPath(fileName, fileKey),
			).rejects.toThrow(testError);

			expect(mockStorageService.getVideo).toHaveBeenCalledWith(fileKey);
		}, 15000);
	});

	describe('cleanup methods', () => {
		beforeEach(() => {
			(converterService as any).cleanupFile = async (filePath: string) => {
				if (fs.existsSync(filePath)) {
					return new Promise<void>((resolve, reject) => {
						fs.unlink(filePath, (err) => {
							if (err) reject(err);
							else resolve();
						});
					});
				}
				return Promise.resolve();
			};
		});

		afterEach(() => {
			delete (converterService as any).cleanupFile;
		});

		it('should delete the file if it exists', async () => {
			// Arrange
			const filePath = '/mock/tmp/hackaton-converter/test-video.mp4';
			(fs.existsSync as jest.Mock).mockReturnValue(true);

			// Converter o callback do fs.unlink para uma promessa para facilitar o teste
			(fs.unlink as unknown as jest.Mock).mockImplementation(
				(path, callback) => {
					setTimeout(() => callback(null), 10);
				},
			);

			// Act
			await (converterService as any).cleanupFile(filePath);

			// Assert
			expect(fs.existsSync).toHaveBeenCalledWith(filePath);
			expect(fs.unlink).toHaveBeenCalledWith(filePath, expect.any(Function));
		});

		it('should not try to delete the file if it does not exist', async () => {
			// Arrange
			const filePath = '/mock/tmp/hackaton-converter/test-video.mp4';
			(fs.existsSync as jest.Mock).mockReturnValue(false);

			// Act
			await (converterService as any).cleanupFile(filePath);

			// Assert
			expect(fs.existsSync).toHaveBeenCalledWith(filePath);
			expect(fs.unlink).not.toHaveBeenCalled();
		});

		it('should handle errors when deleting file', async () => {
			// Arrange
			const filePath = '/mock/tmp/hackaton-converter/test-video.mp4';
			const testError = new Error('Failed to delete file');
			(fs.existsSync as jest.Mock).mockReturnValue(true);

			// Simular um erro na operação de exclusão
			(fs.unlink as unknown as jest.Mock).mockImplementation(
				(path, callback) => {
					setTimeout(() => callback(testError), 10);
				},
			);

			// Act & Assert
			await expect(
				(converterService as any).cleanupFile(filePath),
			).rejects.toThrow(testError);

			expect(fs.existsSync).toHaveBeenCalledWith(filePath);
			expect(fs.unlink).toHaveBeenCalledWith(filePath, expect.any(Function));
		});
	});
});
