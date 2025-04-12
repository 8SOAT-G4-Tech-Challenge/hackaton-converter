import axios from 'axios';
import axiosRetry from 'axios-retry';
import { StatusCodes } from 'http-status-codes';

import { ConvertionNotificationDto } from '@application/dtos/convertionNotificationDto';
import {
	ConvertionStatusEnum,
	ConvertionStatusEnumType,
} from '@application/enumerations/convertionStatusEnum';
import logger from '@common/logger';
import { HackatonApiImpl } from '@driven/external/hackatonApiImpl';

// Mock do axios e axios-retry
jest.mock('axios');
jest.mock('axios-retry');
jest.mock('@common/logger', () => ({
	info: jest.fn(),
	error: jest.fn(),
}));

const mockedAxiosRetry = axiosRetry as jest.MockedFunction<typeof axiosRetry>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

// Mock do process.env
const originalEnv = process.env;
beforeEach(() => {
	jest.resetModules();
	process.env = {
		...originalEnv,
		HACKATON_API_BASE_URL: 'http://test-api.com',
	};
});

afterEach(() => {
	process.env = originalEnv;
	jest.clearAllMocks();
});

describe('HackatonApiImpl', () => {
	let hackatonApi: HackatonApiImpl;

	beforeEach(() => {
		jest.clearAllMocks();

		hackatonApi = new HackatonApiImpl();
	});

	describe('constructor', () => {
		it('should configure axios-retry with correct settings', () => {
			expect(mockedAxiosRetry).toHaveBeenCalledWith(
				axios,
				expect.objectContaining({
					retries: 3,
					retryDelay: axiosRetry.exponentialDelay,
					retryCondition: expect.any(Function),
				}),
			);
		});

		it('should configure retryCondition to retry on specific conditions', () => {
			const axiosRetryCall = mockedAxiosRetry.mock.calls[0];
			const options = axiosRetryCall[1] as any;
			const { retryCondition } = options;

			// Caso 1: Status diferente de NO_CONTENT -> deve retornar true
			const error1 = { status: StatusCodes.BAD_REQUEST };
			expect(retryCondition(error1)).toBe(true);

			// Caso 2: É um erro de rede -> deve retornar true
			const error2 = {};
			jest.spyOn(axiosRetry, 'isNetworkError').mockReturnValueOnce(true);
			expect(retryCondition(error2)).toBe(true);

			// Caso 3: Código é ECONNREFUSED -> deve retornar true
			const error3 = { code: 'ECONNREFUSED' };
			jest.spyOn(axiosRetry, 'isNetworkError').mockReturnValueOnce(false);
			expect(retryCondition(error3)).toBe(true);

			const error4 = {
				status: StatusCodes.NO_CONTENT,
				code: 'OUTRO_ERRO',
			};
			jest.spyOn(axiosRetry, 'isNetworkError').mockReturnValueOnce(true);
			expect(retryCondition(error4)).toBe(true);

			// NOVO CASO: Status é NO_CONTENT mas é erro de rede -> deve retornar true
			const error5 = {
				status: StatusCodes.NO_CONTENT,
			};
			jest.spyOn(axiosRetry, 'isNetworkError').mockReturnValueOnce(false);
			expect(retryCondition(error5)).toBe(false);
		});
	});

	describe('sendNotification', () => {
		it('should log information about the notification', async () => {
			const dto = new ConvertionNotificationDto({
				status: ConvertionStatusEnum.initialized as ConvertionStatusEnumType,
				userId: 'test-user-id',
				fileId: 'test-file-id',
			});

			await hackatonApi.sendNotification(dto);

			expect(mockedLogger.info).toHaveBeenCalledWith(
				expect.stringContaining(
					`Sending status of convertion ${dto.status} to user ${dto.userId}`,
				),
			);
		});

		it('should log error and rethrow when an exception occurs', async () => {
			const dto = new ConvertionNotificationDto({
				status: ConvertionStatusEnum.initialized as ConvertionStatusEnumType,
				userId: 'test-user-id',
				fileId: 'test-file-id',
			});
			const testError = new Error('Test error');

			mockedLogger.info.mockImplementationOnce(() => {
				throw testError;
			});

			await expect(hackatonApi.sendNotification(dto)).rejects.toThrow(
				testError,
			);
			expect(mockedLogger.error).toHaveBeenCalledWith(
				'Error sending status of convertion',
			);
		});

		it('should construct the correct URL for the API call', async () => {
			const dto = new ConvertionNotificationDto({
				status: ConvertionStatusEnum.initialized as ConvertionStatusEnumType,
				userId: 'test-user-id',
				fileId: 'test-file-id',
			});

			await hackatonApi.sendNotification(dto);

			expect(mockedLogger.info).toHaveBeenCalledWith(
				expect.stringContaining('Sending status of convertion initialized to user test-user-id'),
			);
		});
	});
});
