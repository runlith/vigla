<script>
	import { bump, liveCount } from './count.remote.js';

	const live = liveCount();
</script>

<p id="value">{live.current}</p>
<button onclick={() => bump()}>bump</button>
