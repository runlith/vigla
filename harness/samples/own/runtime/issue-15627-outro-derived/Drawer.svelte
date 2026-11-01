<script>
	let { drawer, close } = $props();
	let id = $derived(drawer.id);

	function slide() {
		return { duration: 400 };
	}
</script>

{#if drawer.id}
	<button out:slide|global={id} onclick={close}>Close</button>
{/if}
