<script>
	import { getAbortSignal } from 'svelte';
	import Child from './Child.svelte';

	let state = $state({ visible: true, value: 1 });
	let observing = $state(false);
	let payload = $derived({ value: state.value, signal: getAbortSignal() });
	let child;

	export function remove() {
		state.value = 2;
		state.visible = false;
	}

	export function historical() {
		return child();
	}

	export function current() {
		return payload;
	}

	export function observe() {
		observing = true;
	}
</script>

{#if state.visible}
	<Child read={() => payload} register={(read) => (child = read)} />
{/if}
<output>{observing ? payload.value : ''}</output>
