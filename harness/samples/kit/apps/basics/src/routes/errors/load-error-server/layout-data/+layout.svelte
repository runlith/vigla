<script lang="ts">
	/** @type {import('./$types').LayoutData} */
	let { data, children } = $props();
</script>

{@render children?.()}

<div id="error-layout-data">{data.answer}</div>
