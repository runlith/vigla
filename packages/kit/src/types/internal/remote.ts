export interface RemoteNode {
	v?: any;
	e?: App.Error;
}
export interface RemoteData {
	_?: any;
	q?: Record<string, RemoteNode>;
	l?: Record<string, RemoteNode>;
	p?: Record<string, RemoteNode>;
	f?: Record<string, RemoteNode>;
	i?: string[];
	r?: boolean;
	redirect?: string;
}
export type RemoteResponse =
	| { type: 'result'; data: string | null }
	| { type: 'error'; error: App.Error }
	| { type: 'redirect'; location: string };
export interface BinaryFormMeta {
	remote_refreshes?: string[];
	validate_only?: boolean;
}
export interface InternalFormIssue {
	name: string;
	path: Array<string | number>;
	message: string;
	server?: boolean;
}
export interface RemoteFormResult {
	submission?: boolean;
	input?: Record<string, any>;
	issues?: InternalFormIssue[];
	result?: any;
}
