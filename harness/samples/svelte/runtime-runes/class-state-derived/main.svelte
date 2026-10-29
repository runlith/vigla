<script>
	class Counter {
		count = $state(0);
		doubled = $derived(this.count * 2);
	}

	const counter = new Counter();
</script>

<button onclick={() => counter.count++}>{counter.count}</button>
<p>doubled: {counter.doubled}</p>
