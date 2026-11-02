<script>
	let { clicks } = $props();
</script>

<button onclick={() => clicks.push('click')}>press</button>
