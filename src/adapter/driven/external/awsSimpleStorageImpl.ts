import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import logger from '@common/logger';
import { AwsSimpleStorage } from '@ports/output/awsSimpleStorage';

export class AwsSimpleStorageImpl implements AwsSimpleStorage {
	async getObject(key: string) {
		const bucket = process.env.AWS_BUCKET;
		const client = new S3Client({ region: process.env.AWS_REGION });
		const input = {
			Bucket: bucket,
			Key: key,
		};
		logger.info(`[CONVERTER SERVICE] Getting object ${key} from AWS bucket ${bucket}`);
		const command = new GetObjectCommand(input);
		const response = await client.send(command);
		logger.info(`[CONVERTER SERVICE] Successfully obtained object ${key}`);
		return {
			key,
			content: response?.Body,
			eTag: response?.ETag,
			versionId: response?.VersionId
		};
	}

	async uploadFile(userId: string, key: string, file: any) {
		const client = new S3Client({ region: process.env.AWS_REGION });
		const bucket = process.env.AWS_BUCKET;
		const input = {
			Bucket: bucket,
			Key: `${userId}/images/${key}`,
			Body: file,
			ContentType: 'application/zip'
		};
		logger.info(`[CONVERTER SERVICE] Uploading file ${key} to AWS bucket ${bucket}: ${key}`);
		const command = new PutObjectCommand(input);
		const response = await client.send(command);
		logger.info(`[CONVERTER SERVICE] Successfully uploaded file ${key}`);
		return {
			key: file.key,
			etag: response?.ETag,
			versionId: response?.VersionId
		};
	}
}
