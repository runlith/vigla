<script>
	function create(initial) {
		console.log(value, double);
		var value = $state(initial);
		var double = $derived(value * 2);
		return {
			get value() { return value; },
			get double() { return double; },
			set(next) { value = next; }
		};
	}

	const first = create(2);
	const second = create(7);
</script>

<button onclick={() => first.set(3)}>update</button>
<p>{first.value}/{first.double}|{second.value}/{second.double}</p>
