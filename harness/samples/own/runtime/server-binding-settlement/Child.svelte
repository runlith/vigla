<script>
	import { getContext, setContext } from 'svelte';
	import Grandchild from './Grandchild.svelte';
	let { gate, template, value = $bindable() } = $props();
	setContext('label', `${getContext('label')}:child`);
</script>

<section>{value}<Grandchild {gate} {template} bind:value />{value}</section>
