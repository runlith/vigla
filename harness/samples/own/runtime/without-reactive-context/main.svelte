<script>
	import { detach, roots } from './roots.js';

	let runs = $state(0);

	$effect(() => {
		runs;
		detach(() => {
			$effect.root(() => {
				roots.live++;
				return () => roots.live--;
			});
		});
	});
</script>

<button onclick={() => runs++}>{runs}</button>
