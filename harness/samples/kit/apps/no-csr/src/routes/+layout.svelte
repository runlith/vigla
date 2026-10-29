<script>
	let { children } = $props();
</script>
{@render children?.()}
<footer>footer</footer>

<style>
	footer {
		color: purple;
	}
</style>
