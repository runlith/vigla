export type TrailingSlash = 'always' | 'never' | 'ignore';

export interface SerializedUses {
	dependencies?: string[];
	params?: string[];
	search_params?: string[];
	parent?: 1;
	route?: 1;
	url?: 1;
}

export interface DataNode {
	type: 'data';
	data: Record<string, any> | null;
	uses: SerializedUses;
	slash?: TrailingSlash;
}

export interface DataSkippedNode {
	type: 'skip';
}

export interface DataErrorNode {
	type: 'error';
	error: App.Error;
	status?: number;
}

export interface DataRedirectNode {
	type: 'redirect';
	status: number;
	location: string;
}

export interface DataChunkNode {
	type: 'chunk';
	id: number;
	data?: any;
	error?: any;
}

export interface EncodedDataNode {
	type: 'data';
	data: any;
	uses: SerializedUses;
	slash?: TrailingSlash;
}

export interface DataResponse {
	type: 'data';
	nodes: Array<DataNode | DataSkippedNode | DataErrorNode | null>;
}

export interface EncodedDataResponse {
	type: 'data';
	nodes: Array<EncodedDataNode | DataSkippedNode | DataErrorNode | null>;
}
