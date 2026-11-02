<script>
	import { fork } from 'svelte';

	let source = $state(1);
	let value = $derived(source);
	let selected;

	function select(input, output) {
		selected = [input, output];
		return input === output;
	}

	export function forkView() {
		const staged = fork(() => {
			source = 3;
			value = 1;
		});
		staged.discard();
		return [selected, value];
	}

	export function disconnected() {
		let input = $state(1);
		let output = $derived(input);
		const first = output;
		input = 2;
		output = first;
		return output;
	}

	export async function forkOverrides() {
		let input = $state(1);
		let doubled = $derived(input * 2);
		let output = $derived(doubled / 2);
		const values = [];
		const equal = fork(() => {
			input = 2;
			output = 1;
		});
		values.push(output);
		await equal.commit();
		values.push(output);
		const invalidated = fork(() => {
			output = 99;
			input = 3;
		});
		values.push(output);
		await invalidated.commit();
		values.push(output);
		const discarded = fork(() => {
			input = 4;
			output = 99;
		});
		discarded.discard();
		values.push(output);
		input = 5;
		values.push(output);
		return values;
	}
</script>

<button onclick={() => { source = 2; value = 1; }}>override</button>
<p>{value}</p>
{#if select(source, value)}<span></span>{/if}
