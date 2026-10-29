<script>
	import { engine, world } from './world.svelte.js';

	world.a = 1;
	const found = await engine();
</script>

<p>{found}</p>
