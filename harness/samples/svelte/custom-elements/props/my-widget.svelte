<svelte:options customElement="my-widget" />

<script>
	let { items = [], flag1 = false, flag2 = false } = $props();
</script>

<p>{items.length} items</p>
<p>{items.join(", ")}</p>
<p>{flag1 ? "flagged (dynamic attribute)" : "not flagged"}</p>
<p>{flag2 ? "flagged (static attribute)" : "not flagged"}</p>
