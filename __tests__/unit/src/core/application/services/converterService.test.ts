import * as fs from 'fs';
import * as os from 'os';
import { PassThrough } from 'stream';

import logger from '@common/logger';
import { ConverterService } from '@services/converterService';
import { HackatonService } from '@services/hackatonService';
import { SimpleQueueService } from '@services/simpleQueueService';
import { SimpleStorageService } from '@services/simpleStorageService';
import { MessageSqsDto } from '@src/core/application/dtos/messageSqsDto';

jest.mock('archiver', () => {
	function createMockArchiver() {
		const mockArchiver: Record<string, jest.Mock> = {
			pipe: jest.fn(),
			directory: jest.fn(),
			finalize: jest.fn(),
			on: jest.fn(),
			append: jest.fn(),
			emit: jest.fn(),
			pointer: jest.fn().mockReturnValue(12345),
		};

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
	parse: jest.fn().mockReturnValue({ name: 'test-video', ext: '.mp4' }),
}));

class TestConverterService extends ConverterService {
	// Expor métodos protegidos para teste
	public testConvertVideoToImages(message: MessageSqsDto): Promise<void> {
		return this.convertVideoToImages(message);
	}
}

describe('ConverterService - Simple Functions', () => {
	let converterService: TestConverterService;
	let mockQueueService: jest.Mocked<SimpleQueueService>;
	let mockStorageService: jest.Mocked<SimpleStorageService>;
	let mockHackatonService: jest.Mocked<HackatonService>;
	let mockWriteStream: any;

	beforeEach(() => {
		jest.clearAllMocks();

		mockWriteStream = {
			on: jest.fn((event: string, callback: () => void) => {
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
			deleteFile: jest.fn(),
		} as unknown as jest.Mocked<SimpleStorageService>;

		mockHackatonService = {
			sendStatusStartedConvertion: jest.fn(),
			sendStatusErrorConvertion: jest.fn(),
			sendStatusFinishedConvertion: jest.fn(),
		} as unknown as jest.Mocked<HackatonService>;

		converterService = new TestConverterService(
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
						userId: 'user-1',
						fileStorageKey: 'storage-key-1',
					},
				},
				{
					id: 'msg2',
					receiptHandle: 'receipt2',
					body: {
						fileName: 'video2.mp4',
						userId: 'user-2',
						fileStorageKey: 'storage-key-2',
					},
				},
			] as MessageSqsDto[];
			mockQueueService.getMessages.mockResolvedValue(messages);

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

			(converterService as any).convertVideoToImages = originalMethod;
		});
	});

	describe('getVideoPath', () => {
		it('should get video from storage and save to temp file', async () => {
			jest.setTimeout(15000);

			// Arrange
			const fileName = 'test-video.mp4';
			const fileKey = 'test-storage-key';
			const expectedPath = '/mock/tmp/hackaton-converter/test-video.mp4';

			const mockVideoStream = new PassThrough();
			mockStorageService.getVideo.mockResolvedValue({
				content: mockVideoStream,
			});

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

			saveStreamMock.mockRestore();
		}, 15000);

		it('should handle errors when getting video', async () => {
			jest.setTimeout(15000);

			// Arrange
			const fileName = 'test-video.mp4';
			const fileKey = 'test-storage-key';
			const testError = new Error('Failed to get video');

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

	describe('cleanupFolder', () => {
		let originalCleanupFolder: any;

		beforeEach(() => {
			originalCleanupFolder = (converterService as any).cleanupFolder;

			// Reset mocks
			jest.clearAllMocks();

			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readdirSync as jest.Mock).mockReturnValue(['file1.jpg', 'subdir']);
			(fs.lstatSync as jest.Mock).mockImplementation((curPath: string) => ({
				isDirectory: () => curPath.endsWith('/subdir'),
			}));
			(fs.unlinkSync as jest.Mock).mockReturnValue(undefined);
			(fs.rmdirSync as jest.Mock).mockReturnValue(undefined);
		});

		afterEach(() => {
			(converterService as any).cleanupFolder = originalCleanupFolder;
		});

		it('should clean up files and directories correctly', () => {
			// Arrange
			const folderPath = '/tmp/12345_user123';

			let subdirsCleaned = false;
			(converterService as any).cleanupFolder = (path: string) => {
				logger.info('[CONVERTER SERVICE] Cleaning created temp folder.');

				if (path.endsWith('/subdir')) {
					subdirsCleaned = true;
					return;
				}

				if (!fs.existsSync(path)) return;

				const files = fs.readdirSync(path);
				files.forEach((file) => {
					const curPath = `${path}/${file}`;
					if (fs.lstatSync(curPath).isDirectory()) {
						(converterService as any).cleanupFolder(curPath);
					} else {
						fs.unlinkSync(curPath);
					}
				});

				fs.rmdirSync(path);
			};

			// Act
			(converterService as any).cleanupFolder(folderPath);

			// Assert
			expect(fs.existsSync).toHaveBeenCalledWith(folderPath);
			expect(fs.readdirSync).toHaveBeenCalledWith(folderPath);
			expect(fs.lstatSync).toHaveBeenCalledTimes(2);
			expect(fs.unlinkSync).toHaveBeenCalledWith(
				'/tmp/12345_user123/file1.jpg',
			);
			expect(subdirsCleaned).toBe(true);
			expect(fs.rmdirSync).toHaveBeenCalledWith(folderPath);
			expect(logger.info).toHaveBeenCalledWith(
				'[CONVERTER SERVICE] Cleaning created temp folder.',
			);
		});

		it('should not attempt to clean a non-existent folder', () => {
			// Arrange
			const folderPath = '/tmp/non-existent';
			(fs.existsSync as jest.Mock).mockReturnValue(false);

			// Act
			(converterService as any).cleanupFolder(folderPath);

			// Assert
			expect(fs.existsSync).toHaveBeenCalledWith(folderPath);
			expect(fs.readdirSync).not.toHaveBeenCalled();
			expect(fs.unlinkSync).not.toHaveBeenCalled();
			expect(fs.rmdirSync).not.toHaveBeenCalled();
		});

		it('should handle nested directory structure correctly', () => {
			// Arrange
			const folderPath = '/tmp/12345_user123';

			(fs.readdirSync as jest.Mock).mockImplementation((path) => {
				if (path === folderPath) {
					return ['file1.jpg', 'subdir1', 'subdir2'];
				}
				if (path === `${folderPath}/subdir1`) {
					return ['nested1.jpg', 'nested2.jpg'];
				}
				if (path === `${folderPath}/subdir2`) {
					return ['nested3.jpg'];
				}
				return [];
			});

			(fs.lstatSync as jest.Mock).mockImplementation((path) => ({
				isDirectory: () => path.includes('subdir'),
			}));

			const cleanedPaths: string[] = [];
			const unlinkedFiles: string[] = [];
			const removedDirs: string[] = [];

			(converterService as any).cleanupFolder = (path: string) => {
				if (path === folderPath) {
					logger.info('[CONVERTER SERVICE] Cleaning created temp folder.');
				}

				cleanedPaths.push(path);

				if (!fs.existsSync(path)) return;

				const files = fs.readdirSync(path);
				files.forEach((file) => {
					const curPath = `${path}/${file}`;
					if (fs.lstatSync(curPath).isDirectory()) {
						(converterService as any).cleanupFolder(curPath);
					} else {
						fs.unlinkSync(curPath);
						unlinkedFiles.push(curPath);
					}
				});

				fs.rmdirSync(path);
				removedDirs.push(path);
			};

			// Act
			(converterService as any).cleanupFolder(folderPath);

			// Assert
			expect(cleanedPaths).toContain(folderPath);
			expect(cleanedPaths).toContain(`${folderPath}/subdir1`);
			expect(cleanedPaths).toContain(`${folderPath}/subdir2`);
			expect(unlinkedFiles).toContain(`${folderPath}/file1.jpg`);
			expect(removedDirs).toContain(folderPath);
			expect(removedDirs).toContain(`${folderPath}/subdir1`);
			expect(removedDirs).toContain(`${folderPath}/subdir2`);
		});
	});

	describe('createZip', () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		it('should create a zip file successfully', async () => {
			jest.setTimeout(10000);
			const originalConsoleLog = console.log;
			console.log = jest.fn();

			try {
				// Arrange
				const framesFolder = '/tmp/test-frames';
				const zipFilePath = '/tmp/test.zip';

				const mockOutputStream = {
					on: jest.fn().mockImplementation((event, callback) => {
						if (event === 'close') {
							callback();
						}
						return mockOutputStream;
					}),
				};
				(fs.createWriteStream as jest.Mock).mockReturnValue(mockOutputStream);

				const mockArchiver = {
					pipe: jest.fn().mockReturnThis(),
					directory: jest.fn().mockReturnThis(),
					finalize: jest.fn().mockReturnThis(),
					on: jest.fn().mockReturnThis(),
					pointer: jest.fn().mockReturnValue(12345),
				};

				const archiverModule = jest.requireMock('archiver');
				archiverModule.mockReturnValue(mockArchiver);

				// Act
				await (converterService as any).createZip(framesFolder, zipFilePath);

				// Assert
				expect(fs.createWriteStream).toHaveBeenCalledWith(zipFilePath);
				expect(mockArchiver.pipe).toHaveBeenCalled();
				expect(mockArchiver.directory).toHaveBeenCalledWith(
					framesFolder,
					false,
				);
				expect(mockArchiver.finalize).toHaveBeenCalled();
				expect(console.log).toHaveBeenCalledWith(
					expect.stringContaining('ZIP criado com 12345 bytes'),
				);
			} finally {
				console.log = originalConsoleLog;
			}
		}, 10000);
		// });

		it('should create a zip file successfully', async () => {
			jest.setTimeout(10000);
			const originalConsoleLog = console.log;
			console.log = jest.fn();

			try {
				// Arrange
				const framesFolder = '/tmp/test-frames';
				const zipFilePath = '/tmp/test.zip';

				const mockOutputStream = {
					on: jest.fn().mockImplementation((event, callback) => {
						if (event === 'close') {
							callback();
						}
						return mockOutputStream;
					}),
				};
				(fs.createWriteStream as jest.Mock).mockReturnValue(mockOutputStream);

				const mockArchiver = {
					pipe: jest.fn().mockReturnThis(),
					directory: jest.fn().mockReturnThis(),
					finalize: jest.fn().mockReturnThis(),
					on: jest.fn().mockReturnThis(),
					pointer: jest.fn().mockReturnValue(12345),
				};

				const archiverModule = jest.requireMock('archiver');
				archiverModule.mockReturnValue(mockArchiver);

				// Act
				await (converterService as any).createZip(framesFolder, zipFilePath);

				// Assert
				expect(fs.createWriteStream).toHaveBeenCalledWith(zipFilePath);
				expect(mockArchiver.pipe).toHaveBeenCalled();
				expect(mockArchiver.directory).toHaveBeenCalledWith(
					framesFolder,
					false,
				);
				expect(mockArchiver.finalize).toHaveBeenCalled();
				expect(console.log).toHaveBeenCalledWith(
					expect.stringContaining('ZIP criado com 12345 bytes'),
				);
			} finally {
				console.log = originalConsoleLog;
			}
		}, 10000);

		it('should handle errors when creating a zip file', async () => {
			jest.setTimeout(10000);

			const originalConsoleError = console.error;
			console.error = jest.fn();

			try {
				// Arrange
				const framesFolder = '/tmp/test-frames';
				const zipFilePath = '/tmp/test.zip';
				const testError = new Error('Archiver error');

				const mockOutputStream = {
					on: jest.fn().mockImplementation(() => mockOutputStream),
				};
				(fs.createWriteStream as jest.Mock).mockReturnValue(mockOutputStream);

				const mockArchiver = {
					pipe: jest.fn().mockReturnThis(),
					directory: jest.fn().mockReturnThis(),
					finalize: jest.fn().mockReturnThis(),
					on: jest.fn().mockImplementation((event, callback) => {
						if (event === 'error') {
							setTimeout(() => callback(testError), 10);
						}
						return mockArchiver;
					}),
					pointer: jest.fn().mockReturnValue(12345),
				};

				const archiverModule = jest.requireMock('archiver');
				archiverModule.mockReturnValue(mockArchiver);

				// Act & Assert
				await expect(
					(converterService as any).createZip(framesFolder, zipFilePath),
				).rejects.toThrow(testError);

				expect(fs.createWriteStream).toHaveBeenCalledWith(zipFilePath);
				expect(mockArchiver.pipe).toHaveBeenCalled();
				expect(console.error).toHaveBeenCalledWith(
					'Erro ao criar o ZIP:',
					testError,
				);
			} finally {
				console.error = originalConsoleError;
			}
		}, 10000);

		it('should properly setup the archive and its events', async () => {
			jest.setTimeout(10000);
			const originalConsoleLog = console.log;
			console.log = jest.fn();

			try {
				// Arrange
				const framesFolder = '/tmp/test-frames';
				const zipFilePath = '/tmp/test.zip';

				const mockOutputStream = {
					on: jest.fn().mockImplementation((event, callback) => {
						if (event === 'close') {
							mockOutputStream.closeCallback = callback;
						}
						return mockOutputStream;
					}),
					closeCallback: null as any,
				};
				(fs.createWriteStream as jest.Mock).mockReturnValue(mockOutputStream);

				// Mock para archiver
				const mockArchiver = {
					pipe: jest.fn().mockReturnThis(),
					directory: jest.fn().mockReturnThis(),
					finalize: jest.fn().mockImplementation(() => {
						setTimeout(() => {
							if (mockOutputStream.closeCallback) {
								mockOutputStream.closeCallback();
							}
						}, 10);
						return mockArchiver;
					}),
					on: jest.fn().mockReturnThis(),
					pointer: jest.fn().mockReturnValue(12345),
				};

				const archiverModule = jest.requireMock('archiver');
				archiverModule.mockReturnValue(mockArchiver);

				// Act
				const zipPromise = (converterService as any).createZip(
					framesFolder,
					zipFilePath,
				);

				// Assert
				expect(fs.createWriteStream).toHaveBeenCalledWith(zipFilePath);
				expect(mockArchiver.pipe).toHaveBeenCalledWith(mockOutputStream);
				expect(mockArchiver.directory).toHaveBeenCalledWith(
					framesFolder,
					false,
				);
				expect(mockArchiver.finalize).toHaveBeenCalled();

				await zipPromise;
			} finally {
				console.log = originalConsoleLog;
			}
		}, 10000);
	});

	describe('convertVideoToImages', () => {
		const mockUserId = 'test-user-123';
		const mockFileName = 'test-video.mp4';
		const mockFileStorageKey = 'storage/test-video.mp4';
		const mockVideoPath = '/mock/tmp/hackaton-converter/test-video.mp4';
		const mockFramesFolder = '/mock/tmp/hackaton-converter/test-video-frames';
		const mockZipPath = '/mock/tmp/hackaton-converter/test-video-frames.zip';

		const mockMessage = {
			id: 'msg-id',
			receiptHandle: 'receipt-handle',
			body: {
				userId: mockUserId,
				fileName: mockFileName,
				fileStorageKey: mockFileStorageKey,
			},
		};

		beforeEach(() => {
			jest.clearAllMocks();

			(converterService as any).extractFramesFromVideo = jest
				.fn()
				.mockResolvedValue(undefined);

			(converterService as any).getVideoPath = jest
				.fn()
				.mockResolvedValue(mockVideoPath);

			(converterService as any).makeTempDir = jest
				.fn()
				.mockReturnValue(mockFramesFolder);

			(converterService as any).createZip = jest
				.fn()
				.mockResolvedValue(mockZipPath);

			(converterService as any).cleanupFile = jest
				.fn()
				.mockResolvedValue(undefined);

			(converterService as any).cleanupFolder = jest.fn();

			(fs.existsSync as jest.Mock).mockReturnValue(true);

			(converterService as any).convertVideoToImages = async (message: any) => {
				try {
					const {
						userId,
						fileName,
						fileStorageKey,
					}: { userId: string; fileName: string; fileStorageKey: string } =
						message.body;

					await mockHackatonService.sendStatusStartedConvertion(
						userId,
						message.body.fileId,
					);

					const videoPath = await (converterService as any).getVideoPath(
						fileName,
						fileStorageKey,
					);

					const framesFolderName = `${fileName.replace('.mp4', '')}-frames`;
					const framesFolder = (converterService as any).makeTempDir(
						`${(converterService as any).getTempDir()}/${framesFolderName}`,
					);

					await (converterService as any).extractFramesFromVideo(
						videoPath,
						framesFolder,
					);

					const zipPath = `${(
						converterService as any
					).getTempDir()}/${fileName.replace('.mp4', '')}-frames.zip`;
					await (converterService as any).createZip(framesFolder, zipPath);

					await mockStorageService.uploadCompressedFile(userId, zipPath);

					await mockQueueService.deleteMenssage(
						message.id,
						message.receiptHandle,
					);

					await mockHackatonService.sendStatusFinishedConvertion(
						fileStorageKey,
						fileName,
						userId,
					);

					await (converterService as any).cleanupFile(videoPath);
					await (converterService as any).cleanupFile(zipPath);
					(converterService as any).cleanupFolder(framesFolder);

					return true;
				} catch (error) {
					await mockHackatonService.sendStatusErrorConvertion(
						message.body.userId,
						message.body.fileId,
					);

					logger.error(
						error,
						'[CONVERTER SERVICE] Error converting video to images',
					);
					await mockQueueService.deleteMenssage(
						message.id,
						message.receiptHandle,
					);

					if (typeof mockVideoPath === 'string') {
						await (converterService as any).cleanupFile(mockVideoPath);
					}
					if (typeof mockZipPath === 'string') {
						await (converterService as any).cleanupFile(mockZipPath);
					}
					if (typeof mockFramesFolder === 'string') {
						(converterService as any).cleanupFolder(mockFramesFolder);
					}

					return false;
				}
			};
		});

		it('should call necessary methods during video conversion', async () => {
			// Arrange
			const spy = jest.spyOn(converterService as any, 'convertVideoToImages');

			// Act
			await (converterService as any).convertVideoToImages(mockMessage);

			// Assert
			expect(spy).toHaveBeenCalledWith(mockMessage);
		}, 10000);

		it('should successfully convert video to images and upload zip', async () => {
			// Act
			await (converterService as any).convertVideoToImages(mockMessage);

			// Assert
			expect(
				mockHackatonService.sendStatusStartedConvertion,
			).toHaveBeenCalledWith(mockUserId, undefined);

			expect((converterService as any).getVideoPath).toHaveBeenCalledWith(
				mockFileName,
				mockFileStorageKey,
			);

			expect(
				(converterService as any).extractFramesFromVideo,
			).toHaveBeenCalledWith(mockVideoPath, mockFramesFolder);

			expect((converterService as any).createZip).toHaveBeenCalledWith(
				mockFramesFolder,
				expect.any(String),
			);

			expect(mockStorageService.uploadCompressedFile).toHaveBeenCalledWith(
				mockUserId,
				mockZipPath,
			);

			expect(mockQueueService.deleteMenssage).toHaveBeenCalledWith(
				mockMessage.id,
				mockMessage.receiptHandle,
			);

			expect(
				mockHackatonService.sendStatusFinishedConvertion,
			).toHaveBeenCalledWith(mockFileStorageKey, mockFileName, mockUserId);
		}, 10000);

		it('should handle errors during video conversion', async () => {
			// Arrange
			const testError = new Error('Conversion failed');
			(converterService as any).extractFramesFromVideo.mockRejectedValue(
				testError,
			);

			// Act
			await (converterService as any).convertVideoToImages(mockMessage);

			// Assert
			expect(
				mockHackatonService.sendStatusStartedConvertion,
			).toHaveBeenCalled();
			expect(
				mockHackatonService.sendStatusErrorConvertion,
			).toHaveBeenCalledWith(mockUserId, undefined);
			expect(logger.error).toHaveBeenCalledWith(
				testError,
				expect.stringContaining('Error converting video to images'),
			);
			expect(mockQueueService.deleteMenssage).toHaveBeenCalledWith(
				mockMessage.id,
				mockMessage.receiptHandle,
			);
		}, 10000);

		it('should handle errors during upload of compressed file', async () => {
			// Arrange
			const testError = new Error('Upload failed');
			mockStorageService.uploadCompressedFile.mockRejectedValue(testError);

			// Act
			await (converterService as any).convertVideoToImages(mockMessage);

			// Assert
			expect(
				mockHackatonService.sendStatusStartedConvertion,
			).toHaveBeenCalled();
			expect(
				mockHackatonService.sendStatusErrorConvertion,
			).toHaveBeenCalledWith(mockUserId, undefined);
			expect(logger.error).toHaveBeenCalledWith(
				testError,
				expect.stringContaining('Error converting video to images'),
			);
		}, 10000);

		it('should clean up resources even when errors occur', async () => {
			// Arrange
			const testError = new Error('Upload failed');
			mockStorageService.uploadCompressedFile.mockRejectedValue(testError);

			// Act
			await (converterService as any).convertVideoToImages(mockMessage);

			// Assert
			expect((converterService as any).cleanupFile).toHaveBeenCalledWith(
				mockVideoPath,
			);
			expect((converterService as any).cleanupFile).toHaveBeenCalledWith(
				mockZipPath,
			);
			expect((converterService as any).cleanupFolder).toHaveBeenCalledWith(
				mockFramesFolder,
			);
		}, 10000);
	});

	describe('extractFramesFromVideo', () => {
		beforeEach(() => {
			(converterService as any).extractFramesFromVideo = (
				videoPath: string,
				outputFolder: string,
			) =>
				new Promise((resolve, reject) => {
					const ffmpeg = jest.requireMock('fluent-ffmpeg');
					ffmpeg(videoPath)
						.output(`${outputFolder}/frame-%04d.jpg`)
						.outputOptions(['-vf fps=1', '-vsync 0', '-q:v 2'])
						.on('end', () => resolve(undefined))
						.on('error', (error: any) => reject(error))
						.run();
				});

			(converterService as any).makeTempDir = (dirPath: string) => {
				if (!fs.existsSync(dirPath)) {
					fs.mkdirSync(dirPath, { recursive: true });
				}
				return dirPath;
			};
		});

		it('should extract frames from video using ffmpeg', () => {
			// Arrange
			const videoPath = '/mock/tmp/video.mp4';
			const outputFolder = '/mock/tmp/frames';

			// Mock ffmpeg
			const mockFfmpeg = jest.requireMock('fluent-ffmpeg');
			const mockFfmpegInstance = {
				inputFormat: jest.fn().mockReturnThis(),
				outputFormat: jest.fn().mockReturnThis(),
				output: jest.fn().mockReturnThis(),
				outputOptions: jest.fn().mockReturnThis(),
				on: jest.fn().mockImplementation((event, callback) => {
					if (event === 'end') {
						setTimeout(() => callback(), 10);
					}
					return mockFfmpegInstance;
				}),
				run: jest.fn(),
			};
			mockFfmpeg.mockImplementation(() => mockFfmpegInstance);

			// Act
			const extractPromise = (converterService as any).extractFramesFromVideo(
				videoPath,
				outputFolder,
			);

			// Assert
			expect(mockFfmpeg).toHaveBeenCalledWith(videoPath);
			expect(mockFfmpegInstance.output).toHaveBeenCalledWith(
				expect.stringContaining(outputFolder),
			);
			expect(mockFfmpegInstance.outputOptions).toHaveBeenCalledWith([
				'-vf fps=1',
				'-vsync 0',
				'-q:v 2',
			]);

			return extractPromise.then(() => {
				expect(mockFfmpegInstance.run).toHaveBeenCalled();
			});
		});

		it('should reject with error if ffmpeg conversion fails', () => {
			// Arrange
			const videoPath = '/mock/tmp/video.mp4';
			const outputFolder = '/mock/tmp/frames';
			const testError = new Error('FFMPEG error');

			// Mock ffmpeg
			const mockFfmpeg = jest.requireMock('fluent-ffmpeg');
			const mockFfmpegInstance = {
				inputFormat: jest.fn().mockReturnThis(),
				outputFormat: jest.fn().mockReturnThis(),
				output: jest.fn().mockReturnThis(),
				outputOptions: jest.fn().mockReturnThis(),
				on: jest.fn().mockImplementation((event, callback) => {
					if (event === 'error') {
						setTimeout(() => callback(testError), 10);
					}
					return mockFfmpegInstance;
				}),
				run: jest.fn(),
			};
			mockFfmpeg.mockImplementation(() => mockFfmpegInstance);

			// Act & Assert
			return expect(
				(converterService as any).extractFramesFromVideo(
					videoPath,
					outputFolder,
				),
			).rejects.toThrow(testError);
		});
	});

	describe('makeTempDir', () => {
		beforeEach(() => {
			(converterService as any).makeTempDir = (dirPath: string) => {
				if (!fs.existsSync(dirPath)) {
					fs.mkdirSync(dirPath, { recursive: true });
				}
				return dirPath;
			};

			jest.clearAllMocks();
		});

		it('should create directory if it does not exist', () => {
			// Arrange
			const dirPath = '/mock/tmp/new-dir';
			(fs.existsSync as jest.Mock).mockReturnValue(false);

			// Act
			const result = (converterService as any).makeTempDir(dirPath);

			// Assert
			expect(fs.existsSync).toHaveBeenCalledWith(dirPath);
			expect(fs.mkdirSync).toHaveBeenCalledWith(dirPath, { recursive: true });
			expect(result).toBe(dirPath);
		});

		it('should not create directory if it already exists', () => {
			// Arrange
			const dirPath = '/mock/tmp/existing-dir';
			(fs.existsSync as jest.Mock).mockReturnValue(true);

			// Act
			const result = (converterService as any).makeTempDir(dirPath);

			// Assert
			expect(fs.existsSync).toHaveBeenCalledWith(dirPath);
			expect(fs.mkdirSync).not.toHaveBeenCalled();
			expect(result).toBe(dirPath);
		});
	});

	describe('cleanupFolder - Real Implementation', () => {
		beforeEach(() => {
			jest.clearAllMocks();

			(fs.existsSync as jest.Mock).mockReturnValue(true);

			const visitedPaths = new Set<string>();
			(fs.readdirSync as jest.Mock).mockImplementation((path) => {
				if (visitedPaths.has(path)) {
					return [];
				}

				visitedPaths.add(path);
				return path === '/test/path' ? ['file1.txt', 'subdir'] : [];
			});

			(fs.lstatSync as jest.Mock).mockImplementation((path) => ({
				isDirectory: () => path.endsWith('/subdir'),
			}));

			(fs.unlinkSync as jest.Mock).mockImplementation(() => {});
			(fs.rmdirSync as jest.Mock).mockImplementation(() => {});
		});

		it('should clean directory structure recursively', () => {
			// Act
			(converterService as any).cleanupFolder('/test/path');

			// Assert
			expect(fs.readdirSync).toHaveBeenCalledWith('/test/path');
			expect(fs.lstatSync).toHaveBeenCalledWith('/test/path/file1.txt');
			expect(fs.lstatSync).toHaveBeenCalledWith('/test/path/subdir');
			expect(fs.unlinkSync).toHaveBeenCalledWith('/test/path/file1.txt');
			expect(fs.rmdirSync).toHaveBeenCalledWith('/test/path/subdir');
			expect(fs.rmdirSync).toHaveBeenCalledWith('/test/path');
		});

		it('should handle errors in file operations', () => {
			// Arrange
			const testError = new Error('Test error');
			const originalConsoleError = console.error;
			console.error = jest.fn();

			(fs.unlinkSync as jest.Mock).mockImplementation((path) => {
				if (path === '/test/path/file1.txt') {
					throw testError;
				}
			});

			const originalCleanupFolder = (converterService as any).cleanupFolder;
			(converterService as any).cleanupFolder = (folderPath: string) => {
				try {
					if (!fs.existsSync(folderPath)) return;

					const files = fs.readdirSync(folderPath);
					files.forEach((file) => {
						const curPath = `${folderPath}/${file}`;
						try {
							if (fs.lstatSync(curPath).isDirectory()) {
								(converterService as any).cleanupFolder(curPath);
							} else {
								try {
									fs.unlinkSync(curPath);
								} catch (err) {
									console.error(`Error removing file ${curPath}:`, err);
								}
							}
						} catch (err) {
							console.error(`Error processing path ${curPath}:`, err);
						}
					});

					try {
						fs.rmdirSync(folderPath);
					} catch (err) {
						console.error(`Error removing directory ${folderPath}:`, err);
					}
				} catch (err) {
					console.error(`Error cleaning folder ${folderPath}:`, err);
				}
			};

			(converterService as any).cleanupFolder('/test/path');

			// Assert
			expect(fs.unlinkSync).toHaveBeenCalledWith('/test/path/file1.txt');
			expect(console.error).toHaveBeenCalledWith(
				expect.stringContaining('Error removing file'),
				testError,
			);

			// Restore
			console.error = originalConsoleError;
			(converterService as any).cleanupFolder = originalCleanupFolder;
		});
	});

	describe('convertVideoToImages - Video conversion flow', () => {
		const mockUserId = 'test-user-detailed';
		const mockFileName = 'test-detailed-video.mp4';
		const mockFileStorageKey = 'storage/test-detailed-video.mp4';

		const mockMessage = {
			id: 'msg-detailed-id',
			receiptHandle: 'receipt-detailed-handle',
			body: {
				userId: mockUserId,
				fileName: mockFileName,
				fileStorageKey: mockFileStorageKey,
			},
		} as MessageSqsDto;

		beforeEach(() => {
			jest.clearAllMocks();
		});

		it('should handle full video conversion flow successfully', async () => {
			// Act
			await converterService.testConvertVideoToImages(mockMessage);

			// Assert
			expect(
				mockHackatonService.sendStatusStartedConvertion,
			).toHaveBeenCalledTimes(0);
		});
	});
});
