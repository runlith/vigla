/// <reference path="../../types/history.d.ts" preserve="true" />
import type {
	Builder as KitBuilder,
	error as kitError,
	redirect as kitRedirect,
	RouteDefinition
} from '@vigla/kit';

export * from '@vigla/kit';

export type ErrorProperties = Omit<App.Error, 'status' | 'message'>;
export type LegacyErrorBody = Omit<App.Error, 'status'> & { status?: App.Error['status'] };
export type ErrorFunction = typeof kitError & ((status: number, body: LegacyErrorBody) => never);

export interface AdapterEntry {
	id: string;
	filter(route: RouteDefinition): boolean;
	complete(entry: {
		generateManifest(options: { relativePath: string }): string;
	}): void | Promise<void>;
}
export interface Builder extends KitBuilder {
	createEntries?: (fn: (route: RouteDefinition) => AdapterEntry) => Promise<void>;
	generateManifest?: (options: { relativePath: string; routes?: RouteDefinition[] }) => string;
}

export declare const VERSION: string;
export declare const error: ErrorFunction;
export declare const redirect: typeof kitRedirect;
