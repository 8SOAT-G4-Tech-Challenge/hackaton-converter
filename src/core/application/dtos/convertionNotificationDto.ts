import { ConvertionStatusEnum } from '@application/enumerations/convertionStatusEnum';

export class ConvertionNotificationDto {
	status: ConvertionStatusEnum;

	compressedFileKey?: string;

	userId: string;

	constructor(status: ConvertionStatusEnum, userId: string, compressedFileKey: string = '') {
		this.status = status;
		this.compressedFileKey = compressedFileKey;
		this.userId = userId;
	}
}
