import type { StandardSchemaV1 } from '@standard-schema/spec';
import type {
	ActionFailure as FailureContract,
	HttpError as HttpErrorContract,
	Redirect as RedirectContract,
	RedirectStatus,
	ValidationError as ValidationContract
} from '../types/outcomes.ts';

export class HttpError implements HttpErrorContract {
	status: number;
	body: App.Error;

	constructor(body: App.Error) {
		this.body = body;
		this.status = body.status;
	}

	toString(): string {
		return JSON.stringify(this.body);
	}
}

export class Redirect implements RedirectContract {
	status: RedirectStatus;
	location: string;

	constructor(status: RedirectStatus, location: string) {
		try {
			new Headers({ location });
		} catch {
			throw new Error(
				`Invalid redirect location ${JSON.stringify(location)}: this string contains characters that cannot be used in HTTP headers`
			);
		}
		this.status = status;
		this.location = location;
	}
}

export class ActionFailure<T = undefined> {
	status: number;
	data: T;

	constructor(status: number, data: T) {
		this.status = status;
		this.data = data;
	}
}
export interface ActionFailure<T = undefined> extends FailureContract<T> {}

export class ValidationError extends Error implements ValidationContract {
	issues: StandardSchemaV1.Issue[];

	constructor(issues: StandardSchemaV1.Issue[]) {
		super('Validation failed');
		this.name = 'ValidationError';
		this.issues = issues;
	}
}
