<script>
	import { fork } from 'svelte';

	function installed(value) {
		return (node) => {
			node.dataset.value = value;
			console.log(value);
			return () => {
				delete node.dataset.value;
				console.log(`-${value}`);
			};
		};
	}

	const first = installed('a');
	const intermediate = installed('b');
	const last = installed('c');
	let attachment = $state(first);
	let input = $state(0);
	let staged;
	const queued = [];

	function delayed(value) {
		return value === 0 ? 0 : new Promise(resolve => queued.push(() => resolve(value)));
	}

	const output = $derived(await delayed(input));
</script>

<button onclick={() => staged = fork(() => attachment = undefined)}>stage removal</button>
<button onclick={() => staged.discard()}>discard</button>
<button onclick={() => { input = 1; attachment = intermediate; }}>hold</button>
<button onclick={() => { staged = fork(() => attachment = last); staged.commit(); }}>merge</button>
<button onclick={() => queued.shift()?.()}>resolve</button>
<p {@attach attachment}>{output}</p>
