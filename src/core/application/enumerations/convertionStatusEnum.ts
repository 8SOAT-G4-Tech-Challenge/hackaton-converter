export const ConvertionStatusEnum = {
	started: 'started',
	pending: 'pending',
	finished: 'finished',
	error: 'error',
};

export type ConvertionStatusEnumType = keyof typeof ConvertionStatusEnum;
