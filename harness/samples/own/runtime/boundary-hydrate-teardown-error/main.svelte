<script module>
	if (!customElements.get('teardown-throwing-element')) {
		customElements.define(
			'teardown-throwing-element',
			class extends HTMLElement {
				set value(_) {
					throw new Error('setter error');
				}
			}
		);
	}
</script>

<script>
	import Child from './Child.svelte';

	let { client } = $props();
</script>

<svelte:boundary>
	<Child {client} />
	<teardown-throwing-element {...{ value: 'boom' }}></teardown-throwing-element>

	{#snippet failed(error)}<p>failed: {error.message}</p>{/snippet}
</svelte:boundary>
