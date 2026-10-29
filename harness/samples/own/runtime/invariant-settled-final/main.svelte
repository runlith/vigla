<script>
	let x = $state(0);
	let y = $state(0);
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

	const sum = $derived(x + y);

	$effect(() => {
		console.log(`${x} ${y} ${sum}`);
	});
</script>

<button
	onclick={() => {
		hold();
		x = 1;
	}}>x</button
>
<button onclick={() => (y = 1)}>y</button>
<button onclick={() => release()}>release</button>
<p>{y}</p>
<b>{await slow(x)}</b>
