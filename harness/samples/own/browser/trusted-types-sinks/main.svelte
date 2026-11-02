<script>
	let { markup = $bindable() } = $props();
</script>

<svelte:head>
	<script src="data:text/javascript,void 0"></script>
	<script>document.documentElement.dataset.trustedText = 'ran';</script>
</svelte:head>

<div contenteditable bind:innerHTML={markup}></div>
