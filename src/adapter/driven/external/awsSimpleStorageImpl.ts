import { AwsSimpleStorage } from "@ports/output/awsSimpleStorage";
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import logger from '@common/logger';

export class AwsSimpleStorageImpl implements AwsSimpleStorage {

    async getObject(key: string) {
        try {
            logger.info(`Getting object ${key}`);
            const client = new S3Client({ region: process.env.AWS_REGION });
            const input = {
                Bucket: process.env.IMAGES_BUCKET,
                Key: key
            };
            logger.info(`Getting object ${key} from AWS bucket ${process.env.IMAGES_BUCKET}`);
            const command = new GetObjectCommand(input);
            const response = await client.send(command);
            logger.info(`Successfully obtained object ${key}`);
            return {
                key,
                content: response?.Body,
                eTag: response?.ETag,
                versionId: response?.VersionId
            }
        } catch (error) {
            logger.error(`Error getting object ${key} to AWS bucket ${process.env.IMAGES_BUCKET}`);
            throw error;
        }
    }

    async uploadFile(file: any) {
        try {
            logger.info(`Uploading file ${file.name}`);
            const client = new S3Client({ region: process.env.AWS_REGION });
            const key = file.key + this.generateDateStringKey() + file.name;
            const input = {
                Bucket: process.env.CONVERTION_BUCKET,
                Key: key,
                Body: file.content
            };
            logger.info(`Uploading file ${file.name} to AWS bucket ${process.env.CONVERTION_BUCKET}: ${JSON.stringify(input)}`);
            const command = new PutObjectCommand(input);
            const response = await client.send(command);
            logger.info(`Successfully uploaded file ${file.name}`);
            return {
                fileName: file.name,
                key,
                etag: response?.ETag,
                versionId: response?.VersionId
            };
        } catch (error) {
            logger.error(`Error uploading file ${file.name} to AWS bucket ${process.env.CONVERTION_BUCKET}`);
            throw error;
        }
    }

    generateDateStringKey(): string {
        const now = new Date();
        const ano = now.getFullYear();
        const mes = String(now.getMonth() + 1).padStart(2, '0');
        const dia = String(now.getDate()).padStart(2, '0');
        const minuto = String(now.getMinutes()).padStart(2, '0');
        const segundo = String(now.getSeconds()).padStart(2, '0');
        return `${ano}${mes}${dia}${minuto}${segundo}`;
    }
}