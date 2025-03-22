import { FastifyInstance } from 'fastify';

export const routes = async (fastify: FastifyInstance) => {
	fastify.get('/health', async (_request, reply) => {
		reply.status(200).send({ message: 'Health Check Converter - Ok' });
	});
};
