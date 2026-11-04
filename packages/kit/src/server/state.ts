import { getContext, getOwner } from 'vigla';
import type { Page, Updated } from '../types/state.ts';
import type { ParamValue } from '../types/params.ts';
import { state_read_outside_render, server_api_unavailable } from './errors.ts';

export const stateKey = Symbol('page state');

export function renderedPage(): Page<Record<string, ParamValue>> {
	return (
		(getOwner() ? getContext<Page<Record<string, ParamValue>> | undefined>(stateKey) : undefined) ??
		state_read_outside_render({ name: 'page' })
	);
}

export const page: Page<Record<string, ParamValue>> = {
	get url() {
		return renderedPage().url;
	},
	get params() {
		return renderedPage().params;
	},
	get route() {
		return renderedPage().route;
	},
	get status() {
		return renderedPage().status;
	},
	get error() {
		return renderedPage().error;
	},
	get data() {
		return renderedPage().data;
	},
	get state() {
		return renderedPage().state;
	},
	get shallow() {
		return renderedPage().shallow;
	},
	get form() {
		return renderedPage().form;
	}
};

export const navigating = {
	from: null,
	to: null,
	type: null,
	willUnload: null,
	delta: null,
	complete: null
};
export const updated: Updated = {
	current: false,
	check: () => server_api_unavailable({ name: 'updated.check()' })
};
