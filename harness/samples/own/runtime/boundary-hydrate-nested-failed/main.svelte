<script module>
	if (!customElements.get('nested-throwing-element')) {
		customElements.define(
			'nested-throwing-element',
			class extends HTMLElement {
				set value(_) {
					throw new Error('setter error');
				}
			}
		);
	}
</script>

<script>
	let { fail } = $props();

	function inner() {
		if (fail) throw new Error('server error');
		return 'inner';
	}
</script>

<svelte:boundary>
	<nested-throwing-element {...{ value: 'boom' }}></nested-throwing-element>
	<svelte:boundary>
		{inner()}
		{#snippet failed()}<p>inner failed</p>{/snippet}
	</svelte:boundary>
	<p>outer tail</p>

	{#snippet failed()}<p>outer failed</p>{/snippet}
</svelte:boundary>

<p>after</p>
