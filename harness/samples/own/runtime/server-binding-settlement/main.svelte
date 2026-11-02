<script>
	import { setContext } from 'svelte';
	import Child from './Child.svelte';
	let { gate, label, template = false } = $props();
	let value;
	setContext('label', label);
</script>

<svelte:head><meta name="bound" content={value} /></svelte:head>
<p>{value}</p><Child {gate} {template} bind:value /><p>{value}</p>
