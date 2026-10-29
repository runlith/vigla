<script>
	import { example } from './example.remote';

	let { data } = $props();
</script>

<p>{data.example}</p>
<button onclick={async () => (data.example = await example('baz'))}>Refresh</button>
