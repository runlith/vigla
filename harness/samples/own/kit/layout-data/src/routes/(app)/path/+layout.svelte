<script lang="ts">
	const { children, data } = $props();
	const { root, child } = $derived(data);

	$effect(() => {
		console.log(root, child);
	});
</script>

{@render children()}
