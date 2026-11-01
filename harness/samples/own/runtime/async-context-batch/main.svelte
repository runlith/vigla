<script>
	let n = $state(1);
	let first = true;
	const resolvers = [];

	function next() {
		if (first) {
			first = false;
			return true;
		}
		const { promise, resolve } = Promise.withResolvers();
		resolvers.push(() => resolve(true));
		return promise;
	}

	function shift() {
		resolvers.shift()?.();
	}

	$effect(shift);
</script>

<button onclick={() => n++}>increment</button>
<button onclick={shift}>resolve</button>
<p>{n}/{await next() && n}</p>
