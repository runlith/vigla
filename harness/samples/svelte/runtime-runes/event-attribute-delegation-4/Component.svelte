<script>
	const { children, ...props } = $props();
</script>

<div {...props}>
	{@render children()}
</div>
