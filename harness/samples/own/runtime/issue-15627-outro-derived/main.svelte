<script>
	import Drawer from './Drawer.svelte';

	let state = $state({ drawer: undefined });
</script>

{#if state.drawer}
	<Drawer drawer={state.drawer} close={() => delete state.drawer} />
{/if}
<button onclick={() => (state.drawer = { id: 123 })}>Open</button>
