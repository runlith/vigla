<script>
	let { data } = $props();
	const { root, child } = $derived(data);
	$effect(() => console.log(`${root}/${child}`));
</script>

<p>child</p>
