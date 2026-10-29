<script>
	let { children } = $props();
</script>
{@render children?.()}
<p id="nested-foo">Nested layout foo</p>
