export class ConverterInfoDto {
	fileName: string;

	fileStorageKey: string;

	userId: string;

	fileId: string;

	screenshotsTime: number;

	constructor(converterInfoObject: ConverterInfoDto) {
		this.fileName = converterInfoObject.fileName;
		this.fileStorageKey = converterInfoObject.fileStorageKey;
		this.userId = converterInfoObject.userId;
		this.fileId = converterInfoObject.fileId;
		this.screenshotsTime = Number(converterInfoObject.screenshotsTime);
	}
}
