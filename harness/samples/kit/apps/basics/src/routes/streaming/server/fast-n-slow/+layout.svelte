<script>
	/** @type {import('./$types').LayoutData} */
	let { data, children } = $props();
</script>

{#await data.fast}
	<p class="loadingfast">Loading fast</p>
{:then result}
	<p class="fast">{result}</p>
{/await}

{@render children?.()}
