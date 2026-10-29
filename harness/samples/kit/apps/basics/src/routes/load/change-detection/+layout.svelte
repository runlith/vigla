<script>
	/** @type {import('./$types').LayoutData} */
	let { data, children } = $props();
</script>

<h1>{data.type} loads: {data.loads}</h1>
{@render children?.()}
