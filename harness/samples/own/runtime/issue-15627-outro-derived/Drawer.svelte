<script>
	let { drawer, duration, close } = $props();
	let id = $derived(drawer.id);
	let selectedDuration = $derived(duration);
	let names = $derived(Object.keys(drawer).join(','));

	function slide(node, params) {
		node.dataset.parameters = `${params.id}:${params.duration}:${params.selectedDuration}:${params.names}`;
		return { duration: 400 };
	}
</script>

{#if drawer.id}
	<button out:slide|global={{ id, duration, selectedDuration, names }} onclick={close}>Close</button>
{/if}
