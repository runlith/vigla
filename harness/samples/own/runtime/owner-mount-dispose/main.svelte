<script>
	let { clicks, initialized } = $props();
	initialized?.();
</script>

<button onclick={() => clicks.push('click')}>press</button>
