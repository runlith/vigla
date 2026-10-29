<script>
	let a = $state(0);
	let b = $state(0);
	let c = $state(0);
	let gate = Promise.resolve();
	let release = () => {};

	function hold() {
		gate = new Promise((resolve) => {
			release = resolve;
		});
	}

	async function slow(value) {
		await gate;
		return value;
	}

	const items = $derived([a * b]);
</script>

<button
	onclick={() => {
		hold();
		a = 1;
	}}>a</button
>
<button onclick={() => (b = 1)}>b</button>
<button onclick={() => (c = 1)}>c</button>
<button onclick={() => release()}>release</button>
{#each items as n, index (index)}
	<p>item {n}</p>
{/each}
<i>{c}</i>
<b>{await slow(a)}</b>
