export interface AwsSimpleStorage {
    getObject(key: string):Promise<any>;
    uploadFile(userId: string, key: string, file:any): Promise<any>;
}
