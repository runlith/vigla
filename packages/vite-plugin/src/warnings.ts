import type { Warning } from './compiler.ts';
import type { ModuleRequest } from './id.ts';
import { buildExtendedLogMessage, type Log } from './log.ts';
import type { ResolvedOptions } from './options.ts';

function ignored(warning: Warning, isBuild: boolean, emitCss: boolean): boolean {
	return (
		(!emitCss && warning.code === 'css_unused_selector') ||
		(!isBuild && warning.code === 'css_unused_selector' && warning.message.includes('"*"'))
	);
}

function warnDev(log: Log, warning: Warning): void {
	if (warning.filename?.includes('node_modules')) {
		if (log.debugs('node-modules-onwarn')) {
			log.debug(buildExtendedLogMessage(warning), undefined, 'node-modules-onwarn');
		}
	} else if (log.info.enabled) {
		log.info(buildExtendedLogMessage(warning));
	}
}

function warnBuild(log: Log, warning: Warning): void {
	if (warning.filename?.includes('node_modules')) {
		if (log.debugs('node-modules-onwarn')) {
			log.debug(buildExtendedLogMessage(warning), warning.frame, 'node-modules-onwarn');
		}
	} else if (log.warn.enabled) {
		log.warn(buildExtendedLogMessage(warning), warning.frame);
	}
}

export function logCompilerWarnings(
	request: ModuleRequest,
	warnings: Warning[],
	options: ResolvedOptions,
	log: Log
): void {
	const { emitCss, onwarn, isBuild } = options;
	const viaSocket = !isBuild && options.experimental?.sendWarningsToBrowser;
	const handled: Warning[] = [];
	const base = (warning: Warning) => (isBuild ? warnBuild : warnDev)(log, warning);
	const warn = viaSocket
		? (warning: Warning) => {
				handled.push(warning);
				base(warning);
			}
		: base;
	const kept = warnings?.filter((warning) => !ignored(warning, isBuild, emitCss)) ?? [];
	for (const warning of kept) {
		if (onwarn) onwarn(warning, warn);
		else warn(warning);
	}
	if (!viaSocket) return;
	log.debug(`sending svelte:warnings message for ${request.normalizedFilename}`);
	options.server?.ws?.send('svelte:warnings', {
		id: request.id,
		filename: request.filename,
		normalizedFilename: request.normalizedFilename,
		timestamp: request.timestamp,
		warnings: handled,
		allWarnings: kept,
		rawWarnings: warnings
	});
}
