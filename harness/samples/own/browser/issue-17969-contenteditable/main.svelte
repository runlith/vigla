<script>
	const text = $state({ current: 'Hello' });
	let editing = $state(false);
	const tag = $state('h1');
</script>

{#if !editing}
	<svelte:element this={tag} class="test">{text.current}</svelte:element>
{:else}
	<svelte:element this={tag} contenteditable="plaintext-only" class="test" bind:textContent={text.current}>{text.current}</svelte:element>
{/if}
<button onclick={() => editing = !editing}>{editing ? 'Disable Edit' : 'Enable Edit'}</button>
<output>{text.current}</output>
<style>.test { min-height: 50px; border: 1px solid red; }</style>
