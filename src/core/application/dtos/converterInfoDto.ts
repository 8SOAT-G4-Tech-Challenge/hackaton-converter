export class ConverterInfoDto {
	fileName?: string;

	fileStorageKey?: string;

	userId?: string;

	constructor(converterInfoObject: any) {
		if (converterInfoObject) {
			if (converterInfoObject.fileName) {
				this.fileName = converterInfoObject.fileName;
			}

			if (converterInfoObject.fileStorageKey) {
				this.fileStorageKey = converterInfoObject.fileStorageKey;
			}

			if (converterInfoObject.userId) {
				this.userId = converterInfoObject.userId;
			}
		}
	}
}
