<script>
	let { shown, time = $bindable(0), width = $bindable(), height = $bindable() } = $props();
</script>

{#if shown}<video bind:currentTime={time} bind:videoWidth={width} bind:videoHeight={height}></video>{/if}
<output>{time}</output>
