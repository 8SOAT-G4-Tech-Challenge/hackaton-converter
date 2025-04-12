import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import logger from '@common/logger';
import { AwsSimpleStorage } from '@ports/output/awsSimpleStorage';

export class AwsSimpleStorageImpl implements AwsSimpleStorage {
	private client = new S3Client({ region: process.env.AWS_REGION });

	async getObject(key: string): Promise<any> {
		const bucket = process.env.AWS_BUCKET;
		const input = {
			Bucket: bucket,
			Key: key,
		};
		logger.info(
			`[CONVERTER SERVICE] Getting object ${key} from AWS bucket ${bucket}`
		);
		const command = new GetObjectCommand(input);
		const response = await this.client.send(command);
		logger.info(`[CONVERTER SERVICE] Successfully obtained object ${key}`);
		return {
			key,
			content: response?.Body,
			eTag: response?.ETag,
			versionId: response?.VersionId,
		};
	}

	async uploadFile(userId: string, key: string, file: any): Promise<void> {
		const bucket = process.env.AWS_BUCKET;
		const input = {
			Bucket: bucket,
			Key: `${userId}/images/${key}`,
			Body: file,
			ContentType: 'application/zip',
		};
		logger.info(
			`[CONVERTER SERVICE] Uploading file ${key} to AWS bucket ${bucket}: ${key}`
		);
		const command = new PutObjectCommand(input);
		await this.client.send(command);
		logger.info(`[CONVERTER SERVICE] Successfully uploaded file ${key}`);
	}

	async deleteFile(key: string): Promise<void> {
		try {
			const bucket = process.env.AWS_BUCKET;
			const input = {
				Bucket: bucket,
				Key: key,
			};

			const command = new DeleteObjectCommand(input);

			await this.client.send(command);

			console.log(
				`[CONVERTER SERVICE] Arquivo ${key} deletado do bucket ${bucket}`
			);
		} catch (error) {
			console.error(
				`[CONVERTER SERVICE] Erro ao deletar arquivo ${key} do bucket:`,
				error
			);
		}
	}
}
