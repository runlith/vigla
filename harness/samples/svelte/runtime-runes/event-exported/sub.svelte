<script>
	let count = $state(0)

	export function increment() {
		count += 1
	}
</script>

<button onclick={increment}>Count: {count}</button>
