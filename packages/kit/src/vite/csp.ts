import { ViteMessages } from './messages.ts';
import type { Project } from './project.ts';

export function requireHtmlPolicy(project: Project): void {
	const policy = project.format?.htmlPolicy;
	const directives = project.config.csp.directives;
	if (
		policy &&
		directives['require-trusted-types-for']?.includes('script') &&
		!directives['trusted-types']?.includes(policy)
	)
		new ViteMessages(project.diagnostics).config_csp_trusted_html_missing({ policy });
}
