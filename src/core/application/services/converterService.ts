import logger from '@common/logger';
import { SimpleQueueService } from '@services/simpleQueueService'
import { MessageSqsDto } from '@application/dtos/messageSqsDto';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

export class ConverterService {
	private readonly simpleQueueService;
	private outputDir = 'C:\\Users\\User\\Projects\\hackaton-converter\\images';
	private videoPath = 'C:\\Users\\User\\Projects\\hackaton-converter\\Marvel_DOTNET_CSHARP.mp4';

	constructor(simpleQueueService: SimpleQueueService) {
		this.simpleQueueService = simpleQueueService;
		ffmpeg.setFfmpegPath(ffmpegPath.path)
	}

	async convertVideos(): Promise<void> {
		logger.info(`[CONVERTER SERVICE] Starting video conversion`);
		// const messages: MessageSqsDto[] = await this.simpleQueueService.getMessages();
		// logger.info('Messages', messages)
		this.convertVideoToImages(this.videoPath, this.outputDir);
	}

	private convertVideoToImages(videoPath: string, outputDir: string) {
		if (!fs.existsSync(outputDir)) {
		  fs.mkdirSync(outputDir, { recursive: true });
		}
	  
		const outputPattern = path.join(outputDir, 'imagem-%03d.jpg');
	  
		ffmpeg(this.videoPath)
		  .on('end', () => {
			logger.info(`Video ${videoPath} to image conversion completed`);
		  })
		  .on('error', (error: Error) => {
			logger.error(`Error converting video ${videoPath} to images: ${error.message}`);
		  })
		  .outputOptions([
			'-vf', 'fps=1/20',
			'-q:v', '2',
		  ])
		  .save(outputPattern);
	};
	
	
}
