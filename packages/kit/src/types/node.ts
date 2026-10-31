import type { IncomingMessage, ServerResponse } from 'node:http';

export interface RequestInput {
	request: IncomingMessage;
	response?: ServerResponse;
	base: string;
	bodySizeLimit?: number;
}
export type GetRequest = (input: RequestInput) => Request;
export type SetResponse = (response: ServerResponse, result: Response) => void;
