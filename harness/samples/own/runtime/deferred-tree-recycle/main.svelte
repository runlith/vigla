<script>
	import Consumer from './Consumer.svelte';

	let open = $state(true);
	let session = $state('1');
</script>

<button
	onclick={() => {
		open = false;
		session = '2';
	}}>recycle</button
>
<button onclick={() => (open = true)}>open</button>
<svelte:boundary>
	{#snippet pending()}<i>loading</i>{/snippet}
	{#if open}
		<Consumer {session} />
	{/if}
</svelte:boundary>
