
export class ConverterInfoDto {
    videoName?: string; 
    storageUrl?: string;
    userId?: string;

    constructor(converterInfoObject: any) {
        if (converterInfoObject) {
            if (converterInfoObject.videoName) {
                this.videoName = converterInfoObject.videoName;
            }

            if (converterInfoObject.storageUrl) {
                this.storageUrl = converterInfoObject.storageUrl;
            }

            if (converterInfoObject.userId){
                this.userId = converterInfoObject.userId;
            }
        }
    }

}