<script>
	import Sub from './sub.svelte';
	let sub = $state();
</script>

<Sub bind:this={sub} />
<button onclick={() => sub.increment()}>{sub?.count} / {sub?.doubled}</button>
