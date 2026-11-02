<script>
	import { flushSync } from 'svelte';
	let { register } = $props();
	let count = $state(0);
	let finish;

	register({ hold: () => count = 1, release: () => finish() });
	let result = $derived((await gate(count), count === 0 ? undefined : flushSync(), count));

	function gate(value) {
		return value === 0 ? 0 : new Promise((resolve) => (finish = () => resolve(value)));
	}
</script>

<output>{result}</output>
