<script>
	import Service from './Service.svelte';
	import { store } from './store.svelte.js';

	let open = $state(true);
</script>

<button
	onclick={() => {
		open = false;
		store.count += 1;
	}}>close</button
>
<button onclick={() => (store.other += 1)}>bump</button>
{#if open}
	<Service />
{/if}
