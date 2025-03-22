import 'dotenv/config';

import fastify from 'fastify';

import logger from '@common/logger';
import { errorHandler } from '@driver/errorHandler';
import fastifyCors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import { routes } from '@routes/index';
import cron from 'node-cron'
import { SimpleQueueService } from '@services/simpleQueueService'
import { ConverterService } from '@services/converterService'
import { AwsSimpleQueueImpl } from '@src/adapter/driven/external/awsSimpleQueueImpl';

export const app = fastify();

app.register(fastifyCors, {
	origin: '*',
});

app.register(fastifyMultipart);

app.register(helmet, {
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", "'unsafe-inline'"],
			objectSrc: ["'none'"],
			upgradeInsecureRequests: [],
		},
	},
	frameguard: {
		action: 'deny',
	},
	referrerPolicy: {
		policy: 'no-referrer',
	},
	xssFilter: true,
	noSniff: true,
});

app.register(routes, { prefix: '/converter' });

app.setErrorHandler(errorHandler);

async function run() {
	await app.ready();

	await app.listen({
		port: Number(process.env.API_PORT) || 3000,
		host: '0.0.0.0',
	});

	const job = cron.schedule('* * * * *', () => {
		const awsSimpleQueueImpl = new AwsSimpleQueueImpl();
		const simpleQueueService = new SimpleQueueService(awsSimpleQueueImpl);
		const converterService = new ConverterService(simpleQueueService);
		converterService.convertVideos();
	});

	job.start();

	logger.info('Microservice/Converter running at http://localhost:3000');
}

run();
