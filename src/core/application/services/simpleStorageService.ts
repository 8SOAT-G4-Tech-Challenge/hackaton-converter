import * as fs from 'fs';

import logger from '@common/logger';
import { AwsSimpleStorage } from '@ports/output/awsSimpleStorage';

export class SimpleStorageService {
	private readonly awsSimpleStorage;

	constructor(awsSimpleStorage: AwsSimpleStorage) {
		this.awsSimpleStorage = awsSimpleStorage;
	}

	async getVideo(key: string): Promise<any> {
		logger.info(`[CONVERTER SERVICE] Getting video ${key}`);
		return this.awsSimpleStorage.getObject(key);
	}

	async uploadCompressedFile(userId: string, filePath: any): Promise<string> {
		logger.info(
			`[CONVERTER SERVICE] Uploading compressed image file ${filePath}`
		);
		const fileContent = fs.readFileSync(filePath);
		const filePathValues = filePath.split('/');
		const compressedFileKey = filePathValues[filePathValues.length - 1];
		await this.awsSimpleStorage.uploadFile(
			userId,
			compressedFileKey,
			fileContent
		);
		return compressedFileKey;
	}

	async deleteFile(key: string): Promise<void> {
		logger.info(`[CONVERTER SERVICE] Removing file from bucket ${key}`);
		await this.awsSimpleStorage.deleteFile(key);
	}
}
