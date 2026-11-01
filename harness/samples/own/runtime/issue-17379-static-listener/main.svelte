<script>
	let visible = $state(true);
	let focuses = $state(0);
	let clicks = $state(0);
</script>

<button onclick={() => visible = false}>Remove</button>
<p>{focuses}:{clicks}</p>
{#if visible}
	<input type="radio" onfocus={() => focuses++} onclick={() => clicks++} />
{/if}
