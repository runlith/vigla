<script>
	import { ticker } from './live.remote.js';
</script>

{#each [1, 2, 3] as id (id)}
	<p class="tick">{ticker(id).current}</p>
{/each}
<a id="away" href="/live-release/away">away</a>
