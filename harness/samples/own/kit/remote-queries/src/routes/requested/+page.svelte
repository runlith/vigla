<script>
	let result = $state('');

	async function run() {
		const response = await fetch('/requested/api', { method: 'POST' });
		result = `${response.status} ${await response.text()}`;
	}
</script>

<button onclick={run}>run</button>
<p id="result">{result}</p>
