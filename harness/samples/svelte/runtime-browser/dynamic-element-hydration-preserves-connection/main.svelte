<script>
	let { tag = 'div', empty_tag = 'div', void_tag = 'input', custom_tag = 'connection-probe' } = $props();
</script>

<svelte:element this={tag} id="parent"><connection-probe id="child"></connection-probe></svelte:element>
<svelte:element this={empty_tag} id="empty" />
<svelte:element this={void_tag} id="void" />
<svelte:element this={custom_tag} id="custom" />
