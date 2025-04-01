import { ConverterInfoDto } from '@application/dtos/converterInfoDto';

export class MessageSqsDto {
	id?: string;

	body?: ConverterInfoDto;

	receiptHandle?: string;

	constructor(messageObject: any) {
		if (messageObject) {
			if (messageObject.Body) {
				this.body = new ConverterInfoDto(JSON.parse(messageObject.Body));
			}
			if (messageObject.MessageId) {
				this.id = messageObject.MessageId;
			}
			if (messageObject.ReceiptHandle) {
				this.receiptHandle = messageObject.ReceiptHandle;
			}
		}
	}
}
