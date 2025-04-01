export interface AwsSimpleQueue {
    receiveMessages():Promise<any>;
    deleteMessage(messageId: string, receiptHandle: string):Promise<void>;
}
