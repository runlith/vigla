<script>
	import Entry from './Entry.svelte';

	let iterations = 0;
	const values = {
		[Symbol.iterator]() {
			iterations++;
			return [1, 2][Symbol.iterator]();
		}
	};

	export function traversals() {
		return iterations;
	}
</script>

{#each values as value}
	<Entry {value} />
{/each}
