<svelte:options customElement={{}} />

{#if $$slots.foo}
	<slot name="foo" />
{:else}
	<b>missing</b>
{/if}
