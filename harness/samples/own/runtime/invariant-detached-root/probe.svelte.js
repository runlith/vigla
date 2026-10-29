export const counter = $state({ value: 0 });

$effect.root(() => {
	$effect(() => {
		console.log(`root ${counter.value}`);
	});
});
