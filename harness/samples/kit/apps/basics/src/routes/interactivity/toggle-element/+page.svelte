<script>
	let visible = $state(true);

	function toggle() {
		visible = !visible;
	}
</script>

{#if visible}
	<button onclick={toggle}>remove</button>

	<!-- svelte-ignore a11y_missing_attribute a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<a onclick={toggle}>remove</a>
{:else}
	<button onclick={toggle}>add</button>

	<!-- svelte-ignore a11y_missing_attribute a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<a onclick={toggle}>add</a>
{/if}
