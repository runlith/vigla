<script>
	let { children } = $props();
</script>
<svelte:head>
	<base href="/" />
</svelte:head>

{@render children?.()}
