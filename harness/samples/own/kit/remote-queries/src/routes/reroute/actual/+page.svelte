<script>
	import { routeInfo } from '../info.remote.js';
	let result = $state('');

	async function run() {
		result = await routeInfo();
	}
</script>

<button onclick={run}>run</button>
<p id="result">{result}</p>
