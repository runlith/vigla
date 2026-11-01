<script>
	import { onDestroy, untrack } from 'svelte';
	let { model } = $props();
	onDestroy(() => console.log([model.value, $state.snapshot(model.value), untrack(() => model.value)].join('|')));
</script>

<p>{model.value}</p>
