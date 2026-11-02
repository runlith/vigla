export function find(array, item) {
	return array.lastIndexOf(item);
}

export const optional = (value, argument) => value?.items.includes(argument());
export const contains = (value) => [value].includes(null);
export const search = (array, value) => array.includes(value);

export function* take(object) {
	return (object.items ??= yield []);
}

export async function fill(object, create) {
	return (object.items ||= await create());
}

export let box = $state({ items: null });
export async function put() {
	return (box.items = await Promise.resolve([]));
}
