export const ConvertionStatusEnum = {
	initialized: 'initialized',
	processing: 'processing',
	processed: 'processed',
	error: 'error',
} as const;

export type ConvertionStatusEnumType = keyof typeof ConvertionStatusEnum;
