export class ConverterInfoDto {
	fileName: string;

	fileStorageKey: string;

	userId: string;

	constructor(converterInfoObject: any) {
		this.fileName = converterInfoObject.fileName;
		this.fileStorageKey = converterInfoObject.fileStorageKey;
		this.userId = converterInfoObject.userId;
	}
}
