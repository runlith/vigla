<script>
	import Button from './Button.svelte';
	let text = $state('click me');
	let text2 = $state('');
	let spread = { onclick: () => text = 'click spread' };
</script>

<Button onclick={() => text = 'click onclick'} {...spread}>
	{text}
</Button>

<Button {...spread} onclick={() => text = 'click onclick'}>
	{text}
</Button>

<Button onclick={() => text = 'click onclick'} {...spread} onclickcapture={() => text2 = '!'}>
	{text}{text2}
</Button>

<Button onclickcapture={() => text2 = '?'} {...spread} onclick={() => text = 'click onclick'}>
	{text}{text2}
</Button>
