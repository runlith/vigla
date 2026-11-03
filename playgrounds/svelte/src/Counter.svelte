<script>
	let count = $state(0);
	const double = $derived(count * 2);

	$effect(() => {
		document.title = `count ${count}`;
	});
</script>

<button onclick={() => count++}>clicked {count}</button>
<span class="muted">double: {double}</span>
