<script>
	class Counter {
		#count = $state.raw();

		constructor(initial_count) {
			this.#count = { a: initial_count };
		}

		get count() {
			return this.#count;
		}
		set count(val) {
			this.#count = val;
		}
	}
	const counter = new Counter(0);
</script>

<button
	onclick={() => {
		counter.count.a++;
	}}>{counter.count.a}</button
>
