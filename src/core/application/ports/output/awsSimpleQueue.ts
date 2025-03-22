
export interface AwsSimpleQueue {
    receiveMessages():Promise<void>;
}
