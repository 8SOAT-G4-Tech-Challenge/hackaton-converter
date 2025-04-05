import axios from 'axios';
import axiosRetry from 'axios-retry';
import { StatusCodes } from 'http-status-codes';

import { ConvertionNotificationDto } from '@application/dtos/convertionNotificationDto';
import logger from '@common/logger';
import { HackatonApi } from '@ports/output/hackatonApi';

export class HackatonApiImpl implements HackatonApi {
	constructor() {
		axiosRetry(axios, {
			retries: 3,
			retryDelay: axiosRetry.exponentialDelay,
			retryCondition: (error) =>
				error.status !== StatusCodes.NO_CONTENT ||
				axiosRetry.isNetworkError(error) ||
				error.code === 'ECONNREFUSED',
		});
	}

	async sendNotification(
		convertionNotificationDto: ConvertionNotificationDto
	): Promise<void> {
		try {
			const url = `${process.env.HACKATON_API_BASE_URL}/notifications`;
			logger.info(
				`Sending status of convertion ${convertionNotificationDto.status} to user ${convertionNotificationDto.userId} - path: ${url}`
			);
			// await axios.post(
			// 	url,
			// 	convertionNotificationDto
			// );
		} catch (error) {
			logger.error('Error sending status of convertion');
			throw error;
		}
	}
}
