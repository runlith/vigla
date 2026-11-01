<svelte:options customElement="public-prop-panel" />

<script>
	import Child from './Child.svelte';
	let { ...rest } = $props();
</script>

<Child {...rest} />
