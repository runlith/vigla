<script>
	let x = $state(0);
	let y = $state(false);
	let waiting = $state(0);
	let resolve;

	function hold(value) {
		if (!value) return value;
		return new Promise((done) => (resolve = done));
	}
</script>

<button onclick={() => { x = 1; y = true; waiting = 1; }}>hold</button>
<button onclick={() => x = 2}>overwrite</button>
<button onclick={() => resolve(1)}>resolve</button>
{#if x && y}<span>{x}</span>{/if}
{#each x && y ? [x] : [] as value}<i>{value}</i>{/each}
<small>{await hold(waiting)}</small>
