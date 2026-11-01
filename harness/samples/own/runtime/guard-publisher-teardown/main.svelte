<script>
	import View from './View.svelte';
	import Publisher from './Publisher.svelte';
	import { store } from './word.svelte.js';
	let page = $state('a');
</script>

<button onclick={() => page = page === 'a' ? 'b' : 'a'}>toggle</button>
<View word={store.word} />
{#key page}
	<Publisher word={page === 'a' ? 'twelve dogs' : null} />
{/key}
