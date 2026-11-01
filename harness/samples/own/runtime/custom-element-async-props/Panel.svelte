<svelte:options customElement={{ tag: 'async-prop-panel', props: { count: { type: 'Number', reflect: true }, queued: { type: 'Number', reflect: true } } }} />

<script>
	let { count = 0, queued = 0 } = $props();
	await Promise.resolve();
</script>

<p>{count}/{queued}</p>
