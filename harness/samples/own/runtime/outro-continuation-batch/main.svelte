<script>
	import Child from './Child.svelte';
	import Gate from './Gate.svelte';

	let state = $state({ visible: true, value: 1 });
	let gate;

	export function hold() {
		gate.hold();
	}

	export function release() {
		gate.release();
	}

	export function remove() {
		state.value = 2;
		state.visible = false;
	}
</script>

<Gate register={(api) => (gate = api)} />
{#if state.visible}
	<Child value={state.value} />
{/if}
