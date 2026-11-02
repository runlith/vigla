interface Policy {
	createHTML(input: string): unknown;
	createScript(input: string): unknown;
	createScriptURL(input: string): unknown;
}

type Rules = { [Make in keyof Policy]: (input: string) => string };

interface PolicyFactory {
	createPolicy(name: string, rules: Rules): Policy;
	getAttributeType?(
		element: string,
		attribute: string,
		elementNamespace?: string | null,
		attributeNamespace?: string | null
	): string | null;
}

const makers: Readonly<Record<string, keyof Policy>> = {
	TrustedHTML: 'createHTML',
	TrustedScript: 'createScript',
	TrustedScriptURL: 'createScriptURL'
};

const policies = new Map<string, Policy | null>();

function factory(): PolicyFactory | undefined {
	return (globalThis as { trustedTypes?: PolicyFactory }).trustedTypes;
}

function same(input: string): string {
	return input;
}

function policyNamed(name: string): Policy | null {
	const known = policies.get(name);
	if (known !== undefined) return known;
	let policy: Policy | null = null;
	try {
		policy =
			factory()?.createPolicy(name, {
				createHTML: same,
				createScript: same,
				createScriptURL: same
			}) ?? null;
	} catch {
		policy = null;
	}
	policies.set(name, policy);
	return policy;
}

function trusted(make: keyof Policy, input: string, policy: string): string {
	return (policyNamed(policy)?.[make](input) ?? input) as string;
}

export function trustedHtml(html: string, policy: string): string {
	return trusted('createHTML', html, policy);
}

export function trustedScript(text: string, policy: string): string {
	return trusted('createScript', text, policy);
}

export function trustedAttribute(
	element: Element,
	name: string,
	namespace: string | null,
	value: string,
	policy: string
): string {
	const local = namespace === null ? name : name.slice(name.indexOf(':') + 1);
	const type = factory()?.getAttributeType?.(
		element.localName,
		local,
		element.namespaceURI,
		namespace
	);
	const make = type == null ? undefined : makers[type];
	return make === undefined ? value : trusted(make, value, policy);
}
