<script>
	let { foo } = $props();

	let count = $state(0);
</script>

{@render foo(count)}

<button onclick={() => count += 1}>
	click me
</button>
