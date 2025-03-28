

export interface AwsSimpleStorage {
    getObjects():Promise<any>;
    createObject(): Promise<any>;
}