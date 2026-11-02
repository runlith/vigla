export interface AssignmentTarget<T> {
	current: T;
}

export function assignment<T>(write: (value: T) => void): AssignmentTarget<T> {
	return {
		set current(value: T) {
			write(value);
		}
	};
}

export function mutationTarget<T extends object, K extends keyof T>(
	object: T,
	key: K,
	notify: (value: T[K]) => void
): AssignmentTarget<T[K]> {
	return {
		get current() {
			return object[key];
		},
		set current(value: T[K]) {
			object[key] = value;
			notify(value);
		}
	};
}
