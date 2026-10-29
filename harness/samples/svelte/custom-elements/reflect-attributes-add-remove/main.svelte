<svelte:options
	customElement={{
		tag: 'custom-element',
		props: {
			expanded: { reflect: true, type: 'Boolean', attribute: 'aria-expanded' }
		}
	}}
/>

<script>
	let { expanded = false } = $props();
</script>

<div>
	<button onclick={() => (expanded = !expanded)}>Toggle</button>
	<div class:hidden={!expanded}>Hidden Text</div>
</div>

<style>
	.hidden {
		display: none;
	}
</style>
