<script>
	let items = $state([1, 2, 3]);
	let runs = 0;
	const pending = [];
	window.eachProbe = {
		count() { return runs; },
		reset() { runs = 0; },
		release(count = pending.length) {
			for (const resolve of pending.splice(0, count)) resolve();
		}
	};
	const rows = $derived.by(() => {
		runs++;
		return items.map(value => value * 2);
	});
	function load(value) {
		return new Promise(resolve => pending.push(() => resolve(value)));
	}
</script>

<button onclick={() => items = items.toReversed()}>reverse</button>
{#each rows as row}
	<p>{await load(row)}</p>
{/each}
