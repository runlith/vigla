<script>
	let { children, ...stuff } = $props();
</script>

<button {...stuff}>
	{@render children?.()}
</button>
