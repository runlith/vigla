<script>
	let { value = 1 } = $props();
	String(content);
</script>

{#snippet content()}
	<p>{value}</p>
{/snippet}
