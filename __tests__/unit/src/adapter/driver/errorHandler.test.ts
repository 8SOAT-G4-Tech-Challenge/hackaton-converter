import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';

import { BaseException } from '@application/exceptions/baseException';
import logger from '@common/logger';
import { errorHandler, handleError } from '@driver/errorHandler';

// Mock do logger
jest.mock('@common/logger', () => ({
	error: jest.fn(),
}));

describe('Error Handlers', () => {
	// Mocks para FastifyRequest e FastifyReply
	const mockRequest = () =>
		({
			url: '/test-url',
		} as unknown as FastifyRequest);

	const mockReply = () => {
		const reply = {
			status: jest.fn().mockReturnThis(),
			send: jest.fn().mockReturnThis(),
		} as unknown as FastifyReply;
		return reply;
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('errorHandler (Fastify error handler)', () => {
		it('should handle BaseException with correct status code', () => {
			// Arrange
			const error = new BaseException(
				'Custom error message',
				'BaseException',
				422,
			);
			(error as any).code = 'BASE_EXCEPTION'; // Adiciona código para compatibilidade com FastifyError

			const request = mockRequest();
			const reply = mockReply();

			// Act
			errorHandler(error as unknown as FastifyError, request, reply);

			// Assert
			expect(reply.status).toHaveBeenCalledWith(422);
			expect(reply.send).toHaveBeenCalledWith(
				JSON.stringify({
					path: '/test-url',
					status: 422,
					message: 'Custom error message',
				}),
			);
		});

		it('should handle ZodError with BAD_REQUEST status', () => {
			// Arrange
			const zodError = new ZodError([
				{
					code: 'invalid_type',
					expected: 'string',
					received: 'undefined',
					path: ['name'],
					message: 'Required',
				},
			]) as unknown as FastifyError;
			const request = mockRequest();
			const reply = mockReply();

			// Act
			errorHandler(zodError, request, reply);

			// Assert
			expect(reply.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
			expect(reply.send).toHaveBeenCalledWith(
				JSON.stringify({
					path: '/test-url',
					status: StatusCodes.BAD_REQUEST,
					message: 'name: Required',
				}),
			);
		});

		it('should handle ZodError with multiple validation errors', () => {
			// Arrange
			const zodError = new ZodError([
				{
					code: 'invalid_type',
					expected: 'string',
					received: 'undefined',
					path: ['name'],
					message: 'Required',
				},
				{
					code: 'invalid_type',
					expected: 'number',
					received: 'string',
					path: ['age'],
					message: 'Expected number, received string',
				},
			]) as unknown as FastifyError;
			const request = mockRequest();
			const reply = mockReply();

			// Act
			errorHandler(zodError, request, reply);

			// Assert
			expect(reply.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
			expect(reply.send).toHaveBeenCalledWith(
				JSON.stringify({
					path: '/test-url',
					status: StatusCodes.BAD_REQUEST,
					message: 'name: Required, age: Expected number, received string',
				}),
			);
		});

		it('should handle generic Error with INTERNAL_SERVER_ERROR status', () => {
			// Arrange
			const error = new Error(
				'Something went wrong',
			) as unknown as FastifyError;
			const request = mockRequest();
			const reply = mockReply();

			// Act
			errorHandler(error, request, reply);

			// Assert
			expect(reply.status).toHaveBeenCalledWith(
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
			expect(reply.send).toHaveBeenCalledWith(
				JSON.stringify({
					path: '/test-url',
					status: StatusCodes.INTERNAL_SERVER_ERROR,
					message: 'Something went wrong',
				}),
			);
		});

		it('should handle error without message', () => {
			// Arrange
			const error = {};
			const request = mockRequest();
			const reply = mockReply();

			// Act
			errorHandler(error as any, request, reply);

			// Assert
			expect(reply.status).toHaveBeenCalledWith(
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
			expect(reply.send).toHaveBeenCalledWith(
				JSON.stringify({
					path: '/test-url',
					status: StatusCodes.INTERNAL_SERVER_ERROR,
					message: 'Generic error',
				}),
			);
		});
	});

	describe('handleError (manual error handler)', () => {
		it('should handle BaseException with correct status code', () => {
			// Arrange
			const error = new BaseException(
				'Custom error message',
				'BaseException',
				422,
			);
			const request = mockRequest();
			const reply = mockReply();

			// Act
			handleError(request, reply, error);

			// Assert
			expect(reply.status).toHaveBeenCalledWith(422);
			expect(reply.send).toHaveBeenCalledWith(
				JSON.stringify({
					path: '/test-url',
					status: 422,
					message: 'Custom error message',
				}),
			);
			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining('[❌ ERROR HANDLER] Unexpected error:'),
			);
		});

		it('should handle ZodError with BAD_REQUEST status', () => {
			// Arrange
			const zodError = new ZodError([
				{
					code: 'invalid_type',
					expected: 'string',
					received: 'undefined',
					path: ['name'],
					message: 'Required',
				},
			]);
			const request = mockRequest();
			const reply = mockReply();

			// Act
			handleError(request, reply, zodError);

			// Assert
			expect(reply.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
			expect(reply.send).toHaveBeenCalledWith(
				JSON.stringify({
					path: '/test-url',
					status: StatusCodes.BAD_REQUEST,
					message: 'name: Required',
				}),
			);
			expect(logger.error).toHaveBeenCalled();
		});

		it('should handle generic Error with INTERNAL_SERVER_ERROR status', () => {
			// Arrange
			const error = new Error('Something went wrong');
			const request = mockRequest();
			const reply = mockReply();

			// Act
			handleError(request, reply, error);

			// Assert
			expect(reply.status).toHaveBeenCalledWith(
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
			expect(reply.send).toHaveBeenCalledWith(
				JSON.stringify({
					path: '/test-url',
					status: StatusCodes.INTERNAL_SERVER_ERROR,
					message: 'Something went wrong',
				}),
			);
			expect(logger.error).toHaveBeenCalled();
		});

		it('should use custom message when provided', () => {
			// Arrange
			const error = new Error('Original error');
			const customMessage = 'Custom user-friendly message';
			const request = mockRequest();
			const reply = mockReply();

			// Act
			handleError(request, reply, error, customMessage);

			// Assert
			expect(reply.status).toHaveBeenCalledWith(
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
			expect(reply.send).toHaveBeenCalledWith(
				JSON.stringify({
					path: '/test-url',
					status: StatusCodes.INTERNAL_SERVER_ERROR,
					message: customMessage,
				}),
			);
			expect(logger.error).toHaveBeenCalled();
		});

		it('should handle error without message', () => {
			// Arrange
			const error = {};
			const request = mockRequest();
			const reply = mockReply();

			// Act
			handleError(request, reply, error as any);

			// Assert
			expect(reply.status).toHaveBeenCalledWith(
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
			expect(reply.send).toHaveBeenCalledWith(
				JSON.stringify({
					path: '/test-url',
					status: StatusCodes.INTERNAL_SERVER_ERROR,
					message: 'Generic error',
				}),
			);
			expect(logger.error).toHaveBeenCalled();
		});
	});
});
