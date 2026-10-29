<script>
	/** @type {typeof import('./Dynamic.svelte').default}*/
	let Dynamic = $state();
</script>

<button
	onclick={async () => {
		Dynamic = (await import('./Dynamic.svelte')).default;
	}}>load component</button
>

<Dynamic />
