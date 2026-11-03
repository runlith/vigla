<script>
	import { Accordion, Dialog, Popover, Select, Switch, Tabs } from 'bits-ui';

	let open = $state(false);
	let enabled = $state(true);
	let fruit = $state('apple');

	const fruits = [
		{ value: 'apple', label: 'Apple' },
		{ value: 'banana', label: 'Banana' },
		{ value: 'cherry', label: 'Cherry' }
	];
	const chosen = $derived(fruits.find((item) => item.value === fruit)?.label ?? 'pick one');
</script>

<div class="row">
	<Tabs.Root value="first">
		<Tabs.List class="tabs">
			<Tabs.Trigger value="first">First</Tabs.Trigger>
			<Tabs.Trigger value="second">Second</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="first"><p>First tab content</p></Tabs.Content>
		<Tabs.Content value="second"><p>Second tab content</p></Tabs.Content>
	</Tabs.Root>
</div>

<div class="row">
	<Dialog.Root bind:open>
		<Dialog.Trigger>open dialog</Dialog.Trigger>
		<Dialog.Portal>
			<Dialog.Overlay class="overlay" />
			<Dialog.Content class="dialog">
				<Dialog.Title>Dialog from bits-ui</Dialog.Title>
				<Dialog.Description class="muted">Focus trap, escape and portal all run on Vigla.</Dialog.Description>
				<Dialog.Close>close</Dialog.Close>
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>

	<Popover.Root>
		<Popover.Trigger>popover</Popover.Trigger>
		<Popover.Portal>
			<Popover.Content class="popover" sideOffset={6}>Positioned by floating-ui</Popover.Content>
		</Popover.Portal>
	</Popover.Root>

	<Switch.Root bind:checked={enabled} class="switch">
		<Switch.Thumb class="thumb" />
	</Switch.Root>
	<span class="muted">{enabled ? 'on' : 'off'}</span>
</div>

<div class="row">
	<Select.Root type="single" bind:value={fruit} items={fruits}>
		<Select.Trigger class="trigger">{chosen}</Select.Trigger>
		<Select.Portal>
			<Select.Content class="popover" sideOffset={6}>
				<Select.Viewport>
					{#each fruits as item (item.value)}
						<Select.Item value={item.value} label={item.label} class="option">
							{#snippet children({ selected })}
								{item.label}{selected ? ' ✓' : ''}
							{/snippet}
						</Select.Item>
					{/each}
				</Select.Viewport>
			</Select.Content>
		</Select.Portal>
	</Select.Root>
</div>

<Accordion.Root type="single">
	<Accordion.Item value="one">
		<Accordion.Header><Accordion.Trigger>What is Vigla?</Accordion.Trigger></Accordion.Header>
		<Accordion.Content><p class="muted">The Svelte stack rewritten in TypeScript.</p></Accordion.Content>
	</Accordion.Item>
	<Accordion.Item value="two">
		<Accordion.Header><Accordion.Trigger>Does bits-ui need changes?</Accordion.Trigger></Accordion.Header>
		<Accordion.Content><p class="muted">No: it imports svelte, which resolves to @vigla/svelte.</p></Accordion.Content>
	</Accordion.Item>
</Accordion.Root>

<style>
	.row {
		display: flex;
		gap: 10px;
		align-items: center;
		margin-bottom: 12px;
	}

	:global(.tabs) {
		display: flex;
		gap: 4px;
	}

	:global([data-tabs-trigger][data-state='active']) {
		font-weight: 600;
	}

	:global(.overlay) {
		position: fixed;
		inset: 0;
		background: rgb(0 0 0 / 0.3);
	}

	:global(.dialog) {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: white;
		padding: 20px;
		border-radius: 10px;
		box-shadow: 0 8px 30px rgb(0 0 0 / 0.2);
	}

	:global(.popover) {
		background: white;
		border: 1px solid #d7dae2;
		border-radius: 8px;
		padding: 8px 12px;
		box-shadow: 0 4px 14px rgb(0 0 0 / 0.1);
	}

	:global(.option) {
		padding: 4px 8px;
		cursor: pointer;
	}

	:global(.option[data-highlighted]) {
		background: #eef0f6;
	}

	:global(.switch) {
		width: 40px;
		height: 22px;
		border-radius: 11px;
		background: #c9ccd6;
		border: none;
		padding: 2px;
	}

	:global(.switch[data-state='checked']) {
		background: #3b6cf6;
	}

	:global(.thumb) {
		display: block;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: white;
		transition: transform 0.15s;
	}

	:global(.thumb[data-state='checked']) {
		transform: translateX(18px);
	}
</style>
