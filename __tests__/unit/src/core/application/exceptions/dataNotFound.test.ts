import { DataNotFoundException } from '@application/exceptions/dataNotFound';

describe('DataNotFoundException', () => {
	it('should create an instance with message', () => {
		const message = 'Data not found';

		const error = new DataNotFoundException(message);

		expect(error).toBeInstanceOf(DataNotFoundException);
		expect(error.message).toBe(message);
		expect(error.statusCode).toBe(400);
		expect(error.name).toBe('DataNotFoundException');
	});
});
