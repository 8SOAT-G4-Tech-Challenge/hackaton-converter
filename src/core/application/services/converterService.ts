import archiver from 'archiver';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough, Readable } from 'stream';

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
		hackatonService: HackatonService,
	) {
		this.simpleQueueService = simpleQueueService;
		this.simpleStorageService = simpleStoageService;
		this.hackatonService = hackatonService;
		ffmpeg.setFfmpegPath(ffmpegPath.path);
	}

	async convertVideos() {
		try {
			logger.info('[CONVERTER SERVICE] Starting videos conversion');
			const messages: MessageSqsDto[] =
				await this.simpleQueueService.getMessages();
			logger.info(
				`[CONVERTER SERVICE] Total messages found: ${messages.length}`,
			);
			messages.forEach((message: MessageSqsDto) => {
				this.convertVideoToImages(message);
			});
		} catch (error) {
			logger.error(error, '[CONVERTER SERVICE] Error converting videos');
		}
	}

	private async convertVideoToImages(message: MessageSqsDto): Promise<void> {
		const converterInfoDto = message.body;
		try {
			logger.info(
				`[CONVERTER SERVICE] Starting video ${JSON.stringify(
					converterInfoDto,
				)} conversion`,
			);

			if (
				!converterInfoDto ||
				!converterInfoDto.fileName ||
				!converterInfoDto.userId ||
				!converterInfoDto.fileStorageKey
			) {
				throw new Error(
					'Error converting video to images. Video information is null or empty.',
				);
			}

			await this.hackatonService.sendStatusStartedConvertion(
				converterInfoDto.userId,
			);

			const filesStream = new PassThrough();

			const videoPath = await this.getVideoPath(
				converterInfoDto.fileName,
				converterInfoDto.fileStorageKey,
			);

			ffmpeg(videoPath)
				.inputFormat('mp4')
				.outputFormat('image2pipe')
				.output(filesStream)
				.outputOptions(['-vf', 'fps=1/20', '-q:v', '2'])
				.on('end', () => {
					logger.info(
						`[CONVERTER SERVICE] Video ${converterInfoDto.fileName} to image conversion completed`,
					);
				})
				.on('error', (error: Error) => {
					logger.error(
						`[CONVERTER SERVICE] Error converting video ${converterInfoDto.fileName} to images: ${error.message}`,
					);
				})
				.run();

			const fileCompressedPath = await this.generateImagesCompressedFile(
				converterInfoDto.fileName,
				filesStream,
			);

			const compressedFileKey =
				await this.simpleStorageService.uploadCompressedFile(
					converterInfoDto.userId,
					fileCompressedPath,
				);

			await this.hackatonService.sendStatusFinishedConvertion(
				compressedFileKey,
				converterInfoDto.userId,
			);

			await this.simpleQueueService.deleteMenssage(
				message.id,
				message.receiptHandle,
			);

			logger.info(
				`[CONVERTER SERVICE] Video ${JSON.stringify(
					converterInfoDto,
				)} conversion completed.`,
			);
		} catch (error) {
			logger.error(
				error,
				`[CONVERTER SERVICE] Error converting video ${JSON.stringify(
					converterInfoDto,
				)}`,
			);
			if (converterInfoDto && converterInfoDto.userId) {
				await this.hackatonService.sendStatusErrorConvertion(
					converterInfoDto.userId,
				);
			}
		}
	}

	private async getVideoPath(
		fileName: string,
		fileKey: string,
	): Promise<string> {
		const videoInfo = await this.simpleStorageService.getVideo(fileKey);

		return this.saveStreamToTempFile(videoInfo.content, fileName);
	}

	private generateDateStringKey(): string {
		const now = new Date();
		const ano = now.getFullYear();
		const mes = String(now.getMonth() + 1).padStart(2, '0');
		const dia = String(now.getDate()).padStart(2, '0');
		const hora = String(now.getHours()).padStart(2, '0');
		const minuto = String(now.getMinutes()).padStart(2, '0');
		const segundo = String(now.getSeconds()).padStart(2, '0');
		return `${ano}${mes}${dia}${hora}${minuto}${segundo}`;
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
					`[CONVERTER SERVICE] Stream recorded successfully ${tempFilePath}`,
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

	private async createZipStream(
		imagesStream: Readable,
		fileName: string,
	): Promise<Readable> {
		return new Promise((resolve, reject) => {
			const zipStream = new PassThrough();

			const archive = archiver('zip', {
				zlib: { level: 9 },
			});

			archive.on('error', (error) => {
				console.error('Erro ao criar o ZIP:', error);
				return reject(error);
			});

			archive.pipe(zipStream);

			let imageCount = 0;
			imagesStream.on('data', (chunk) => {
				const imageName = `${fileName}_img${imageCount}.png`;
				archive.append(chunk, { name: imageName });
				imageCount += 1;
			});

			imagesStream.on('error', (error) => reject(error));

			imagesStream.on('end', () => {
				archive.finalize();
				return resolve(zipStream);
			});
		});
	}

	private async generateImagesCompressedFile(
		fileName: string,
		filesStream: Readable,
	): Promise<string> {
		const compressedFileName = fileName.replace('.mp4', '');
		let compressedFileKey = `${compressedFileName.toLowerCase()}_${this.generateDateStringKey()}`;
		const fileZipStream = await this.createZipStream(
			filesStream,
			compressedFileKey,
		);
		compressedFileKey += '.zip';
		await this.saveStreamToTempFile(fileZipStream, compressedFileKey);
		return path.join(this.getTempDir(), compressedFileKey);
	}
}
