<script>
	import Child from './Child.svelte';
	let { namespace } = $props();
</script>

<Child {...namespace} foo="bar" />
