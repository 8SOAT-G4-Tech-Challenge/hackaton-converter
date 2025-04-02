import archiver from 'archiver';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough, Readable } from 'stream';

import { ConverterInfoDto } from '@application/dtos/converterInfoDto';
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
		hackatonService: HackatonService) {
		this.simpleQueueService = simpleQueueService;
		this.simpleStorageService = simpleStoageService;
		this.hackatonService = hackatonService;
		ffmpeg.setFfmpegPath(ffmpegPath.path);
	}

	async convertVideos() {
		try {
			logger.info('[CONVERTER SERVICE] Starting videos conversion');
			const messages: MessageSqsDto[] = await this.simpleQueueService.getMessages();
			logger.info(`[CONVERTER SERVICE] Total messages found: ${messages.length}`);
			messages.forEach((message) => {
				this.convertVideoToImages(message.body);
			});
		} catch (error) {
			logger.error(error, '[CONVERTER SERVICE] Error converting videos');
		}
	}

	private async convertVideoToImages(converterInfoDto?: ConverterInfoDto) {
		const outputStream = new PassThrough();
		logger.info(`[CONVERTER SERVICE] Starting video ${JSON.stringify(converterInfoDto)} conversion`);

		if (!converterInfoDto ||
			!converterInfoDto.fileName ||
			!converterInfoDto.userId ||
			!converterInfoDto.fileStorageKey) {
			throw new Error();
		}

		const videoInfo = await this.simpleStorageService.getVideo(
			converterInfoDto.fileStorageKey);

		const keyArray = converterInfoDto.fileStorageKey.split('/');
		const videoPath = await this.saveStreamToTempFile(
			videoInfo.content,
			keyArray[keyArray.length - 1]);

		ffmpeg(videoPath)
			.inputFormat('mp4')
			.outputFormat('image2pipe')
			.output(outputStream)
			.outputOptions([
				'-vf', 'fps=1/20',
				'-q:v', '2',
			])
			.on('end', () => {
				logger.info(`[CONVERTER SERVICE] Video ${converterInfoDto.fileName} to image conversion completed`);
			})
			.on('error', (error: Error) => {
				logger.error(`[CONVERTER SERVICE] Error converting video ${converterInfoDto.fileName} to images: ${error.message}`);
			})
			.run();

		const fileNameValues = converterInfoDto.fileName.split('.');
		let fileCompressedKey = `${fileNameValues[0].toLowerCase()}_${this.generateDateStringKey()}`;
		const fileZipStream = this.createZipStream(outputStream, fileCompressedKey);
		fileCompressedKey += '.zip';
		await this.saveStreamToTempFile(fileZipStream, fileCompressedKey);
		const fileContent = fs.readFileSync(path.join(this.getTempDir(), fileCompressedKey));
		logger.info(`[CONVERTER SERVICE] Storing compressed images ${fileCompressedKey}`);
		await this.simpleStorageService.uploadCompressedFile(
			converterInfoDto.userId,
			fileCompressedKey,
			fileContent);
	}

	private generateDateStringKey(): string {
		const now = new Date();
		const ano = now.getFullYear();
		const mes = String(now.getMonth() + 1).padStart(2, '0');
		const dia = String(now.getDate()).padStart(2, '0');
		const minuto = String(now.getMinutes()).padStart(2, '0');
		const segundo = String(now.getSeconds()).padStart(2, '0');
		return `${ano}${mes}${dia}${minuto}${segundo}`;
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
				logger.info(`[CONVERTER SERVICE] Stream recorded successfully ${tempFilePath}`);
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

	private createZipStream(imagesStream: Readable, fileName: string): Readable {
		const zipStream = new PassThrough();

		const archive = archiver('zip', {
			zlib: { level: 9 },
		});

		archive.on('error', (err) => {
			console.error('Erro ao criar o ZIP:', err);
		});

		archive.pipe(zipStream);

		let imageCount = 0;
		imagesStream.on('data', (chunk) => {
			const imageName = `${fileName}_img${imageCount}.png`;
			archive.append(chunk, { name: imageName });
			imageCount += 1;
		});

		imagesStream.on('end', () => {
			archive.finalize();
		});

		return zipStream;
	}
}
