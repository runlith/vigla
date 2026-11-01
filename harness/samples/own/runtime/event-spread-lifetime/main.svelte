<script>
	let show = $state(true);
	let revision = $state(0);
	let calls = $state(0);
	const handle = () => calls++;
</script>

<button onclick={() => revision++}>update</button>
<button onclick={() => show = !show}>toggle</button>
<p>{calls}</p>
{#if show}
	<video {...{ onpointerdowncapture: handle, title: revision }}></video>
{/if}
