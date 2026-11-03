<script>
	let { children } = $props();
	$effect(() => {
		document.body.dataset.ready = 'true';
	});
</script>

{@render children()}
