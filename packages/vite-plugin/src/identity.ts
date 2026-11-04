import type { ResolvedConfig } from 'vite';
import { createLog, type Log } from './log.ts';
import { ownMessages, type Messages } from './messages.ts';

export interface Links {
	readonly cssHash?: string;
	readonly preprocess?: string;
	readonly missingCondition?: string;
}

export interface Names {
	readonly prebundle: string;
	readonly resolveWarnings: string;
	readonly warningsEvent: string;
	readonly styleFlag: string;
	readonly metaKey: string;
	readonly metadataFile: string;
	readonly withoutSources: readonly string[];
	readonly withoutSourcesPrefixes: readonly string[];
	readonly links: Links;
}

export interface History {
	options?(options: Record<string, unknown>, log: Log): void;
	config?(config: ResolvedConfig, log: Log): void;
}

export interface Naming {
	readonly name: string;
	readonly names?: Partial<Names>;
	readonly messages?: Partial<Messages>;
	readonly history?: History;
}

export interface Identity {
	readonly name: string;
	readonly log: Log;
	readonly names: Names;
	readonly messages: Messages;
	readonly history: History;
	readonly virtualStyle: RegExp;
}

export const ownNames: Names = {
	prebundle: 'prebundleLibraries',
	resolveWarnings: 'disableResolveWarnings',
	warningsEvent: 'vigla:warnings',
	styleFlag: 'vigla',
	metaKey: 'vigla',
	metadataFile: '_prebundle_metadata.json',
	withoutSources: [],
	withoutSourcesPrefixes: [],
	links: {}
};

function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function styleQuery(names: Names): string {
	return `?${names.styleFlag}&type=style&lang.css`;
}

export function createIdentity({ name, names, messages, history }: Naming): Identity {
	const resolved: Names = { ...ownNames, ...names };
	return {
		name,
		log: createLog(name),
		names: resolved,
		messages: { ...ownMessages, ...messages },
		history: history ?? {},
		virtualStyle: new RegExp(`[?&]${escape(resolved.styleFlag)}&type=style&lang.css$`)
	};
}
