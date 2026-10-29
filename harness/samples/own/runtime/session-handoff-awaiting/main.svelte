<script>
	import Frame from './Frame.svelte';
	import { open, settleAll } from './world.svelte.js';

	let authed = $state(false);
</script>

<button onclick={() => (authed = true)}>login</button>
<button onclick={() => Promise.resolve().then(() => settleAll('answer'))}>answer</button>
<button onclick={open}>chunk</button>
{#key authed}
	<svelte:boundary>
		{#snippet failed(error)}<p>{String(error)}</p>{/snippet}
		<Frame user={authed} awaits={authed} />
	</svelte:boundary>
{/key}
