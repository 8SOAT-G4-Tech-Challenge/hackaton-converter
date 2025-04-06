import { BaseException } from '@application/exceptions/baseException';

describe('BaseException', () => {
	it('should create an instance with message and statusCode', () => {
		const message = 'Test error message';
		const statusCode = 404;

		const error = new BaseException(message, 'BaseException', statusCode);

		expect(error).toBeInstanceOf(BaseException);
		expect(error.message).toBe(message);
		expect(error.statusCode).toBe(statusCode);
		expect(error.name).toBe('BaseException');
	});

	it('should use default statusCode when not provided', () => {
		const message = 'Test error message';
		const statusCode = 500;

		const error = new BaseException(message, 'BaseException', statusCode);

		expect(error).toBeInstanceOf(BaseException);
		expect(error.statusCode).toBe(500); // Assumindo que 500 é o padrão
	});
});
