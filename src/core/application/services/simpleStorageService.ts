// import { MessageSqsDto } from '@application/dtos/messageSqsDto';
import logger from '@common/logger';
import { AwsSimpleStorage } from '@ports/output/awsSimpleStorage';

export class SimpleStorageService {
	private readonly awsSimpleStorage;

	constructor(awsSimpleStorage: AwsSimpleStorage) {
		this.awsSimpleStorage = awsSimpleStorage;
	}

	async getVideo(key: string) {
		logger.info('[CONVERTER SERVICE] Getting video');
		return this.awsSimpleStorage.getObject(key);
	}

	async uploadImage(userId: string, key: string, file: any) {
		logger.info('[CONVERTER SERVICE] Uploading image');
		this.awsSimpleStorage.uploadFile(userId, key, file);
	}
}
