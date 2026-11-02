<script>
	import Drawer from './Drawer.svelte';

	let state = $state({ drawer: undefined, duration: 1 });

	function close() {
		delete state.drawer.id;
		delete state.drawer;
		state.duration = 2;
	}
</script>

{#if state.drawer}
	<Drawer drawer={state.drawer} duration={state.duration} {close} />
{/if}
<button onclick={() => (state.drawer = { id: 123 })}>Open</button>
