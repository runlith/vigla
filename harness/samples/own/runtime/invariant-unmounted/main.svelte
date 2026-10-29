<script>
	import Reader from './Reader.svelte';
	import { shared } from './shared.svelte.js';

	let shown = $state(true);
</script>

<button onclick={() => (shown = false)}>hide</button>
<button onclick={() => (shared.value += 1)}>write</button>
{#if shown}
	<Reader />
{/if}
