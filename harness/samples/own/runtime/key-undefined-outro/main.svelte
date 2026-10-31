<script>
	let key = $state(undefined);

	function leave(node) {
		return {
			duration: 100,
			tick: (value) => node.style.opacity = String(value)
		};
	}
</script>

<button onclick={() => key = 1}>replace</button>

{#key key}
	<p out:leave>{String(key)}</p>
{/key}
