<script>
	class Counter {
		count = $state.raw({ a: 0 });
	}
	const counter = new Counter();
</script>

<button
	onclick={() => {
		counter.count.a++;
	}}>{counter.count.a}</button
>
