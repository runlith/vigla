<script>
	let week = $state(0);
	let open = $state(0);
	const pending = [];
	const runs = { parsed: 0, cells: 0 };

	function load(value) {
		return new Promise(resolve => pending.push(() => resolve(value)));
	}

	window.cacheProbe = {
		release() { for (const resolve of pending.splice(0)) resolve(); },
		reset() { runs.parsed = runs.cells = 0; },
		counts() { return [runs.parsed, runs.cells]; }
	};

	const parsed = $derived.by(() => {
		runs.parsed++;
		return week * 7;
	});
	const cells = $derived.by(() => {
		runs.cells++;
		const values = [];
		for (let i = 0; i < 2; i++) values.push(parsed + i + open + week);
		return values;
	});
	const data = $derived(await load(week));
</script>

<button onclick={() => week++}>next</button>
<button onclick={() => open++}>toggle</button>
<p>{data}: {#each { length: 2 }, i}{cells[i]} {/each}</p>
