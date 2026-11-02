<script>
	let { value, root, register, finish } = $props();
	let selected = $derived(value);
	let transitive = $derived(root());
	let unread = $derived(value * 100);
	let button;

	function read() {
		return [selected, transitive, value, root()];
	}

	function capture(name) {
		button.dataset[name] = JSON.stringify(read());
	}

	register({
		read,
		unread: () => unread,
		timer: () => new Promise((resolve) => setTimeout(() => resolve(read()), 0))
	});

	function motion() {
		capture('options');
		return () => {
			capture('deferred');
			return {
				duration: 100,
				css(t) {
					capture('css');
					return `opacity: ${t}`;
				},
				tick(t) {
					capture('tick');
					if (t === 0) capture('final');
				}
			};
		};
	}
</script>

<svelte:window onmessage={() => capture('event')} />
<button bind:this={button} out:motion onoutrostart={() => capture('start')} onoutroend={() => { capture('end'); finish(); }}>
	{selected}
</button>
