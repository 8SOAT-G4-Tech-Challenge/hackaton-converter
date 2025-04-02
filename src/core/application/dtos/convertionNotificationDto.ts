import { ConvertionStatusEnum } from '@application/enumerations/convertionStatusEnum';

export class ConvertionNotificationDto {
	status: ConvertionStatusEnum;

	images?: string[];

	userId: string;

	constructor(status: ConvertionStatusEnum, userId: string, images: string[] = []) {
		this.status = status;
		this.images = images;
		this.userId = userId;
	}
}
