<script>
	import { invalidate } from '$app/navigation';

	let { data } = $props();
</script>

<div>
	<button
		id="multiple-batched"
		onclick={(event) => {
			const btn = event.currentTarget;
			invalidate('multiple:invalidations-go-brr');
			invalidate('multiple:invalidations-go-brr');

			Promise.resolve()
				.then(() => invalidate('multiple:invalidations-go-brr'))
				.then(() => {
					btn.dataset.done = 'true';
				});
		}}>{data.count}</button
	>
</div>
