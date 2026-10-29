<script>
	let { children } = $props();
</script>
<svelte:head>
	<link rel="alternate" href="/path-base/rss.xml" />
</svelte:head>

{@render children?.()}
