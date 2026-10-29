<script>
	let { condition, children } = $props();
</script>

{#if condition}
	{@render children?.()}
{/if}

<div>
	{@render children?.()}
</div>

hello
