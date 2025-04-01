import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough, Readable } from 'stream';

import { ConverterInfoDto } from '@application/dtos/converterInfoDto';
import { MessageSqsDto } from '@application/dtos/messageSqsDto';
import logger from '@common/logger';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { SimpleQueueService } from '@services/simpleQueueService';
import { SimpleStorageService } from '@services/simpleStorageService';

export class ConverterService {
	private readonly simpleQueueService;

	private readonly simpleStorageService;

	constructor(simpleQueueService: SimpleQueueService, simpleStoageService: SimpleStorageService) {
		this.simpleQueueService = simpleQueueService;
		this.simpleStorageService = simpleStoageService;
		ffmpeg.setFfmpegPath(ffmpegPath.path);
	}

	async convertVideos() {
		try {
			logger.info('[CONVERTER SERVICE] Starting videos conversion');
			const messages: MessageSqsDto[] = await this.simpleQueueService.getMessages();
			logger.info('Messages', messages);
			messages.forEach((message) => {
				this.convertVideoToImages(message.body);
			});
		} catch (error) {
			logger.error(error, '[CONVERTER SERVICE] Error converting videos');
		}
	}

	private async convertVideoToImages(converterInfoDto?: ConverterInfoDto) {
		const stream = new PassThrough();
		logger.info(`[CONVERTER SERVICE] Starting video ${JSON.stringify(converterInfoDto)} conversion`);

		if (!converterInfoDto ||
			!converterInfoDto.fileName ||
			!converterInfoDto.userId ||
			!converterInfoDto.fileStorageKey) {
			throw new Error();
		}

		const videoInfo = await this.simpleStorageService.getVideo(
			converterInfoDto.fileStorageKey);

		const videoPath = await this.saveStreamToTempFile(
			videoInfo.content,
			converterInfoDto.fileStorageKey);

		ffmpeg(videoPath)
			.inputFormat('mp4')
			.outputFormat('image2pipe')
			.output(stream)
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

		const dateStringKeyImages = this.generateDateStringKey();
		let contadorImagem = 0;

		stream.on('data', async (image) => {
			contadorImagem += 1;
			const imageName = `${converterInfoDto.fileName}_${dateStringKeyImages}_img${contadorImagem}.png`;
			try {
				logger.info(`[CONVERTER SERVICE] Storing image ${imageName}`);
				await this.simpleStorageService.uploadImage(
					converterInfoDto.userId,
					imageName,
					image);
			} catch (error) {
				logger.error(error, `[CONVERTER SERVICE] Error storing image ${imageName}`);
			}
		});

		stream.on('end', () => {
			logger.info('[CONVERTER SERVICE] All images were uploaded successfully.');
		});
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
			const tempDir = `${os.tmpdir()}/hackaton-converter`;

			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}

			const keyArray = key.split('/');
			const tempFilePath = path.join(tempDir, keyArray[keyArray.length - 1]);
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
}
