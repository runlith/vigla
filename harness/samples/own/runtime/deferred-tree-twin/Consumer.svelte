<script>
	import { search } from './world.js';

	let { session } = $props();

	const engine = await search(session);
</script>

<p>{engine.find('book')}</p>
