interface Policy {
	createHTML(html: string): unknown;
}

interface PolicyFactory {
	createPolicy(name: string, rules: { createHTML(html: string): string }): Policy;
}

const policies = new Map<string, Policy | null>();

function policyNamed(name: string): Policy | null {
	const known = policies.get(name);
	if (known !== undefined) return known;
	const factory = (globalThis as { trustedTypes?: PolicyFactory }).trustedTypes;
	let policy: Policy | null = null;
	try {
		policy = factory?.createPolicy(name, { createHTML: (html) => html }) ?? null;
	} catch {
		policy = null;
	}
	policies.set(name, policy);
	return policy;
}

export function trustedHtml(html: string, policy: string): string {
	return (policyNamed(policy)?.createHTML(html) ?? html) as string;
}
