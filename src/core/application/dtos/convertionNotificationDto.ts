import { ConvertionStatusEnumType } from '@application/enumerations/convertionStatusEnum';

export class ConvertionNotificationDto {
	status: ConvertionStatusEnumType;

	compressedFileKey?: string;

	userId: string;

	constructor(
		status: ConvertionStatusEnumType,
		userId: string,
		compressedFileKey: string = ''
	) {
		this.status = status;
		this.compressedFileKey = compressedFileKey;
		this.userId = userId;
	}
}
