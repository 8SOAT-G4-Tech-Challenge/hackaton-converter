import archiver from 'archiver';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';

import { MessageSqsDto } from '@application/dtos/messageSqsDto';
import logger from '@common/logger';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { HackatonService } from '@services/hackatonService';
import { SimpleQueueService } from '@services/simpleQueueService';
import { SimpleStorageService } from '@services/simpleStorageService';

export class ConverterService {
	private readonly simpleQueueService;

	private readonly simpleStorageService;

	private readonly hackatonService;

	constructor(
		simpleQueueService: SimpleQueueService,
		simpleStoageService: SimpleStorageService,
		hackatonService: HackatonService
	) {
		this.simpleQueueService = simpleQueueService;
		this.simpleStorageService = simpleStoageService;
		this.hackatonService = hackatonService;
		ffmpeg.setFfmpegPath(ffmpegPath.path);
	}

	private async getVideoPath(
		fileName: string,
		fileKey: string
	): Promise<string> {
		const videoInfo = await this.simpleStorageService.getVideo(fileKey);

		return this.saveStreamToTempFile(videoInfo.content, fileName);
	}

	private saveStreamToTempFile(stream: Readable, key: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const tempDir = this.getTempDir();

			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}

			const tempFilePath = path.join(tempDir, key);
			const writeStream = fs.createWriteStream(tempFilePath);

			stream.pipe(writeStream);

			writeStream.on('finish', () => {
				logger.info(
					`[CONVERTER SERVICE] Stream recorded successfully ${tempFilePath}`
				);
				resolve(tempFilePath);
			});

			writeStream.on('error', (error) => {
				reject(error);
			});
		});
	}

	private getTempDir() {
		return `${os.tmpdir()}/hackaton-converter`;
	}

	protected async createZip(
		framesFolder: string,
		zipFilePath: string
	): Promise<Readable> {
		logger.info('[CONVERTER SERVICE] Starting zip');

		const output = fs.createWriteStream(zipFilePath);

		const archive = archiver('zip', {
			zlib: { level: 9 },
		});

		return new Promise((resolve, reject) => {
			archive.on('error', (error) => {
				console.error('Erro ao criar o ZIP:', error);
				return reject(error);
			});
			output.on('close', () => {
				console.log(`ZIP criado com ${archive.pointer()} bytes`);
				resolve({} as any);
			});
			archive.pipe(output);
			archive.on('error', reject);
			archive.directory(framesFolder, false);
			archive.finalize();
		});
	}

	private readonly cleanupFolder = (folderPath: string) => {
		logger.info('[CONVERTER SERVICE] Cleaning created temp folder.');
		if (!fs.existsSync(folderPath)) return;

		fs.readdirSync(folderPath).forEach((file) => {
			const curPath = path.join(folderPath, file);

			if (fs.lstatSync(curPath).isDirectory()) {
				this.cleanupFolder(curPath);
			} else {
				fs.unlinkSync(curPath);
			}
		});

		fs.rmdirSync(folderPath);
	};

	async convertVideos() {
		try {
			logger.info('[CONVERTER SERVICE] Starting videos conversion');
			const messages: MessageSqsDto[] =
				await this.simpleQueueService.getMessages();
			logger.info(
				`[CONVERTER SERVICE] Total messages found: ${messages.length}`
			);
			messages.forEach((message: MessageSqsDto) => {
				this.convertVideoToImages(message);
			});
		} catch (error) {
			logger.error(error, '[CONVERTER SERVICE] Error converting videos');
		}
	}

	protected async convertVideoToImages(message: MessageSqsDto): Promise<void> {
		const converterInfoDto = message.body;
		try {
			logger.info(
				`[CONVERTER SERVICE] Starting video ${JSON.stringify(
					converterInfoDto
				)} conversion`
			);

			if (
				!converterInfoDto?.fileName ||
				!converterInfoDto?.userId ||
				!converterInfoDto?.fileStorageKey ||
				!converterInfoDto?.fileId ||
				!converterInfoDto?.screenshotsTime
			) {
				throw new Error(
					'Error converting video to images. Video information is null or empty.'
				);
			}

			await this.hackatonService.sendStatusStartedConvertion(
				converterInfoDto.userId,
				converterInfoDto.fileId
			);

			const videoPath = await this.getVideoPath(
				converterInfoDto.fileName,
				converterInfoDto.fileStorageKey
			);

			logger.info(
				`[CONVERTER SERVICE] Getting video from path ${JSON.stringify(
					videoPath
				)}`
			);

			const date = new Date().getTime();
			const baseFolder = `/tmp/${date}_${converterInfoDto.userId}`;
			const framesFolder = `${baseFolder}/frames`;
			const zipFilePath = `${baseFolder}/${date}.zip`;

			logger.info(
				`[CONVERTER SERVICE] Creating temp directory ${framesFolder}`
			);
			fs.mkdirSync(framesFolder, { recursive: true });

			logger.info('[CONVERTER SERVICE] Starting ffmeg');
			await new Promise((resolve, reject) => {
				ffmpeg(videoPath)
					.output(path.join(framesFolder, 'frame-%03d.jpg'))
					.outputOptions([
						'-vf',
						`fps=1/${converterInfoDto.screenshotsTime}`,
						'-q:v',
						'2',
					])
					.on('end', () => {
						logger.info(
							`[CONVERTER SERVICE] Video ${converterInfoDto.fileName} to image conversion completed`
						);
						resolve({});
					})
					.on('error', (error: Error) => {
						logger.error(
							`[CONVERTER SERVICE] Error converting video ${converterInfoDto.fileName} to images: ${error.message}`
						);
						reject(error);
					})
					.run();
			});

			await this.createZip(framesFolder, zipFilePath);

			const compressedFileKey =
				await this.simpleStorageService.uploadCompressedFile(
					converterInfoDto.userId,
					zipFilePath
				);

			await this.hackatonService.sendStatusFinishedConvertion(
				compressedFileKey,
				converterInfoDto.userId,
				converterInfoDto.fileId
			);

			await this.simpleQueueService.deleteMenssage(
				message.id,
				message.receiptHandle
			);

			this.cleanupFolder(baseFolder);

			this.simpleStorageService.deleteFile(converterInfoDto.fileStorageKey);

			logger.info(
				`[CONVERTER SERVICE] Video ${JSON.stringify(
					converterInfoDto
				)} conversion completed.`
			);
		} catch (error) {
			logger.error(
				error,
				`[CONVERTER SERVICE] Error converting video ${JSON.stringify(
					converterInfoDto
				)}`
			);
			if (converterInfoDto?.userId) {
				await this.hackatonService.sendStatusErrorConvertion(
					converterInfoDto.userId,
					converterInfoDto.fileId
				);
			}
		}
	}
}
