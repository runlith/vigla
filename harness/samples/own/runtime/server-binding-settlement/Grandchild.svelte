<script>
	import { getContext } from 'svelte';
	let { gate, template, value = $bindable('initial') } = $props();
	const label = getContext('label');
	if (!template) value = `${await gate}:${label}`;
	async function finish() {
		value = `${await gate}:${label}`;
		return value;
	}
</script>

<svelte:head><title>{value}</title></svelte:head>
<span>{template ? await finish() : value}</span>
