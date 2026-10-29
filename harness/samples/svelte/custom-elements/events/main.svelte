<svelte:options customElement="custom-element" />

<script>
	const dispatch = (type, detail) => $host().dispatchEvent(new CustomEvent(type, { detail }));
</script>

<button onclick={() => dispatch("custom", "foo")}>bubble click</button>
