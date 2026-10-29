<script>
	let { children } = $props();
</script>
{@render children?.()}
<p id="nested">This is a nested layout component</p>
