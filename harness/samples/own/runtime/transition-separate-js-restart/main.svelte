<script>
	let visible = $state(false);
	function enter(node) {
		console.log('in');
		return { duration: 100, tick: (t) => { node.foo = t; } };
	}
	function leave(node) {
		console.log('out');
		return { duration: 100, tick: (t) => { node.bar = t; } };
	}
</script>

<button onclick={() => { visible = !visible; }}>Toggle</button>
{#if visible}
	<span in:enter out:leave>hello</span>
{/if}
