<script>
	let { children } = $props();
</script>

<p>This <code>p</code> and the <code>slot</code> below are direct children of the root.</p>
{@render children?.()}
