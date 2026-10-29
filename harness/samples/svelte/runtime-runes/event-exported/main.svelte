<script>
	import Sub from './sub.svelte'

	let button;
</script>

<Sub bind:this={button} />
<button onclick={() => button.increment()}>Increment</button>
