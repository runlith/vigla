<script>
	import { markSeen } from './seen.remote.js';

	const id = 'a';

	$effect(() => {
		markSeen(id);
	});
</script>

<p>seen</p>
