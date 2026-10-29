<script>
	import { onNavigate } from '$app/navigation';

	/** @type {import("$app/navigation").OnNavigate['from']} */
	let from = $state();

	/** @type {import("$app/navigation").OnNavigate['to']} */
	let to = $state();

	/** @type {Omit<import('$app/navigation').NavigationType, 'enter' | 'leave'>} */
	let type = $state();
	let shallow = $state(false);

	let called_return = $state(false);

	onNavigate((navigation) => {
		from = navigation.from;
		to = navigation.to;
		type = navigation.type;
		shallow = navigation.shallow;
	});

	onNavigate(() => {
		return () => {
			called_return = true;
		};
	});
</script>

<h1>
	{`${from?.url.pathname} -> ${to?.url.pathname} (${type ?? '...'}) ${shallow} ${called_return}`}
</h1>
<a href="/navigation-lifecycle/on-navigate/b">/b</a>
