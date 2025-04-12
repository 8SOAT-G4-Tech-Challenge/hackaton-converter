import { ConvertionStatusEnumType } from '@application/enumerations/convertionStatusEnum';

export class ConvertionNotificationDto {
	status: ConvertionStatusEnumType;

	compressedFileKey?: string;

	userId: string;

	fileId: string;

	constructor(convertionNotification: ConvertionNotificationDto) {
		this.status = convertionNotification.status;
		this.compressedFileKey = convertionNotification.compressedFileKey;
		this.userId = convertionNotification.userId;
		this.fileId = convertionNotification.fileId;
	}
}
