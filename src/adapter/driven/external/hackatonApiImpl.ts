import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';

import { ConvertionNotificationDto } from '@application/dtos/convertionNotificationDto';
import logger from '@common/logger';
import { HackatonApi } from '@ports/output/hackatonApi';

export class HackatonApiImpl implements HackatonApi {
	private readonly axiosInstance: AxiosInstance;

	constructor() {
		this.axiosInstance = axios.create({
			baseURL: process.env.HACKATON_API_BASE_URL,
			headers: {
				'Content-Type': 'application/json',
			},
		});

		axiosRetry(axios, { retries: 3 });
	}

	async sendNotification(convertionNotificationDto: ConvertionNotificationDto): Promise<void> {
		try {
			const path = '/notifications';
			logger.info(`Sending status of convertion ${convertionNotificationDto.status} to user ${convertionNotificationDto.userId} - path: ${path}`);
			await this.axiosInstance.post(
				path,
				convertionNotificationDto
			);
		} catch (error) {
			logger.error(error, 'Error sending status of convertion');
			throw error;
		}
	}
}
