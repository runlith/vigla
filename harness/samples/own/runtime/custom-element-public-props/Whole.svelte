<svelte:options customElement="whole-prop-panel" />

<script>
	import Child from './Child.svelte';
	let props = $props();
</script>

<Child {...props} />
