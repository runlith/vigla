<script>
	import Button from './Button.svelte';

	let count = $state(0);
	let d = $state(1);

	function create_handler() {
		const change = d;

		console.log(`creating handler (${change})`);

		return function increment() {
			count += change;
			console.log(count);
		};
	}
</script>

<button onclick={() => (d += 1)}>increase d ({d})</button>

<button onclick={create_handler()}>
	clicks: {count}
</button>

<Button onclick={create_handler()}>
	clicks: {count}
</Button>
