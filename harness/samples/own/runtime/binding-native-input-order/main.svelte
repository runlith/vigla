<script>
	let value = $state('');
	let stopped = $state(false);
	let events = $state([]);

	function listen(node) {
		function handle(event) {
			events.push(`native:${value}`);
			if (stopped) event.stopPropagation();
		}
		node.addEventListener('input', handle);
		return { destroy: () => node.removeEventListener('input', handle) };
	}
</script>

<button onclick={() => stopped = true}>Stop</button>
<div use:listen>
	<input bind:value oninput={() => events.push(`handler:${value}`)} />
</div>
<p>{events.join('|')}</p>
