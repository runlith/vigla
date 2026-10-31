<script>
	import { writable } from 'svelte/store';
	const count = writable(1);
</script>

{#snippet value()}
	<p>{$count}</p>
{/snippet}

{@render value()}
<button onclick={() => $count++}>increment</button>
