<script>
	import Page from './Page.svelte';
	import { open, world } from './world.svelte.js';

	let shown = $state(false);
</script>

<button onclick={() => (shown = true)}>show</button>
<button onclick={() => (world.b = 2)}>respond</button>
<button onclick={open}>release</button>
{#if shown}
	<svelte:boundary>
		<Page />
	</svelte:boundary>
{/if}
