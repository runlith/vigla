<script>
	let shown = $state(false);
	let entered = $state(false);
</script>

<button id="show" onclick={() => shown = true}>show</button>
{#if shown}
	<button id="hot" onpointerenter={() => entered = true}>{entered}</button>
{/if}
