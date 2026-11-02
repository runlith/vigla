<script>
	import { flushSync } from 'svelte';
	import Child from './Child.svelte';

	let state = $state({ open: true, value: 1 });
	let outer = $derived(state.value * 10);
	let child;
	let restart = false;

	export function restartOnEnd() {
		restart = true;
	}

	function finish() {
		if (!restart) return;
		restart = false;
		flushSync(() => select(true, 7));
		flushSync(() => select(false, 8));
	}

	export function select(open, value) {
		state.value = value;
		state.open = open;
	}

	export function read() {
		return child.read();
	}

	export function unread() {
		return child.unread();
	}

	export function write(value) {
		state.value = value;
		return child.read();
	}

	export function timer() {
		return child.timer();
	}

</script>

{#if state.open}
	<Child value={state.value} root={() => outer} register={(api) => (child = api)} {finish} />
{/if}
