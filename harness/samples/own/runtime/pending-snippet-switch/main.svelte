<script>
	import Pending from './Pending.svelte';
	let id = $state(0);
	let loading = $state(false);
	const gates = [];

	function slow(value) {
		if (value === 0) return Promise.resolve(value);
		return new Promise(resolve => gates.push(() => resolve(value)));
	}

	export function release() {
		gates.shift()?.();
	}
</script>

<button onclick={() => { loading = true; id++; }}>next</button>
{#snippet pending()}<Pending />{/snippet}
<svelte:boundary pending={loading ? pending : undefined}>
	<h1>{await slow(id)}</h1>
</svelte:boundary>
