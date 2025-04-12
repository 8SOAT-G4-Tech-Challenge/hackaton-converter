import 'dotenv/config';

import fastify from 'fastify';
import cron from 'node-cron';

import logger from '@common/logger';
import { AwsSimpleQueueImpl } from '@driven/external/awsSimpleQueueImpl';
import { AwsSimpleStorageImpl } from '@driven/external/awsSimpleStorageImpl';
import { HackatonApiImpl } from '@driven/external/hackatonApiImpl';
import { errorHandler } from '@driver/errorHandler';
import fastifyCors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import { routes } from '@routes/index';
import { ConverterService } from '@services/converterService';
import { SimpleQueueService } from '@services/simpleQueueService';
import { SimpleStorageService } from '@services/simpleStorageService';
import { HackatonService } from '@src/core/application/services/hackatonService';

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
		const awsSimpleStorageImpl = new AwsSimpleStorageImpl();
		const hackatonApiImpl = new HackatonApiImpl();
		const simpleQueueService = new SimpleQueueService(awsSimpleQueueImpl);
		const simpleStorageService = new SimpleStorageService(awsSimpleStorageImpl);
		const hackatonService = new HackatonService(hackatonApiImpl);
		const converterService = new ConverterService(
			simpleQueueService,
			simpleStorageService,
			hackatonService
		);
		converterService.convertVideos();
	});

	job.start();

	logger.info('Microservice/Converter running at http://localhost:3000');
}

run();
