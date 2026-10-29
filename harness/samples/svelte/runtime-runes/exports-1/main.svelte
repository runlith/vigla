<script>
	import Sub from './sub.svelte'
	let sub
</script>

<Sub bind:this={sub} />
<button onclick={() => sub.increment()}>Increment</button>
<button onclick={() => sub.decrement()}>Decrement</button>
<button onclick={() => sub.double()}>Double</button>
