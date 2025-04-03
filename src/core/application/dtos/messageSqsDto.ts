import { ConverterInfoDto } from '@application/dtos/converterInfoDto';

export class MessageSqsDto {
	id: string;

	body: ConverterInfoDto;

	receiptHandle: string;

	constructor(messageObject: any) {
		this.body = new ConverterInfoDto(JSON.parse(messageObject.Body));
		this.id = messageObject.MessageId;
		this.receiptHandle = messageObject.ReceiptHandle;
	}
}
