<script>
	let shown = $state(true);
	let a = $state(0);
	let b = $state(0);
	let gate = $state(0);
	const stable = $derived(b % 1);
	const waits = [];

	function wait(value) {
		return value === 0 ? value : new Promise((resolve) => waits.push(() => resolve(value)));
	}

	function pick(first, second) {
		return first === 1 && second === 0;
	}
</script>

<button onclick={() => ((a = 1), (gate = 1))}>a</button>
<button onclick={() => (b = 1)}>b</button>
<button onclick={() => ((shown = false), (a = 0), (gate = 2))}>hide</button>
<button onclick={() => (shown = true)}>show</button>
<button onclick={() => waits.shift()?.()}>resolve</button>

<p>{await wait(gate)}</p>
{#if shown}{#if pick(a, stable)}<span>yes</span>{/if}{/if}
