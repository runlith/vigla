<script>
	import { afterNavigate } from '$app/navigation';

	let count = $state(0);
	let type = $state('');

	afterNavigate((event) => {
		count += 1;
		type = event.type;
	});
</script>

<p>{type.toString()} {count}</p>
