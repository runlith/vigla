declare module 'axobject-query' {
	interface Concept {
		readonly name: string;
		readonly attributes?: readonly { readonly name: string; readonly value?: string }[];
	}

	interface AXObject {
		readonly type: string;
	}

	interface MapLike<Key, Value> {
		entries(): [Key, Value][];
		get(key: Key): Value | undefined;
		keys(): Key[];
	}

	export const AXObjects: MapLike<string, AXObject>;
	export const AXObjectRoles: MapLike<string, Set<{ readonly name: string }>>;
	export const elementAXObjects: MapLike<Concept, Set<string>>;
}
