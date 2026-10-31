<script>
	import { root } from 'vigla';
	import Page from './Page.svelte';

	let { hooks, value } = $props();
	let shown = $state(true);

	export function childRoots(parent) {
		let revision = $state(0);
		const child = $derived.by(() => {
			revision;
			return root(undefined, parent);
		});
		return {
			current: () => child,
			next: () => revision++
		};
	}
</script>

<button onclick={() => (shown = false)}>leave</button>
{#if shown}
	<Page {hooks} {value} />
{/if}
