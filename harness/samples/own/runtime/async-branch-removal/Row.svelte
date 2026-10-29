<script>
	let { active, tick } = $props();
</script>

{#if tick >= 0 && active === 'one'}<b>{tick}</b>{/if}
