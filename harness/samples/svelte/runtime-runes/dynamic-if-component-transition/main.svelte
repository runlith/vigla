<script>
	import Component from "./Component.svelte"
	let shown = $state(false);
	let Dynamic = $state(Component);
</script>

{#if shown}
	Nothing
{:else}
	<Dynamic />
{/if}

