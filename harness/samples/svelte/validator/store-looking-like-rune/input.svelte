<script>
	import { writable } from 'svelte/store';

	let { initial } = $props();
	// svelte-ignore state_referenced_locally
	const state = writable(initial);
</script>

<div>{$state}</div>
