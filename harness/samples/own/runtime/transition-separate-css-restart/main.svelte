<script>
	let visible = $state(false);
	function enter() {
		return { duration: 100, css: (t) => `scale: ${t}` };
	}
	function leave() {
		return { duration: 100, css: (t) => `rotate: ${t * 360}deg; opacity: ${t}` };
	}
</script>

<button onclick={() => { visible = !visible; }}>Toggle</button>
{#if visible}
	<div in:enter out:leave></div>
{/if}
