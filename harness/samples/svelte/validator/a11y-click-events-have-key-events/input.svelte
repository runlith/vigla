<script>
	function noop() {}

	let props = {};

	const dynamicTypeValue = "checkbox";
	const dynamicAriaHiddenValue = "false";
	const dynamicRole = "button";
</script>

<!-- should warn -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={noop}></div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={noop} aria-hidden="false"></div>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<section onclick={noop}></section>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<main onclick={noop}></main>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<article onclick={noop}></article>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<header onclick={noop}></header>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<footer onclick={noop}></footer>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<footer onclick={noop}></footer>

<!-- should not warn -->
<div class="foo"></div>

<a href="http://x.y.z" onclick={noop}>foo</a>
<button onclick={noop}>click me</button>
<select onclick={noop}></select>

<input type="button" onclick={noop} />
<input type={dynamicTypeValue} onclick={noop} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={noop} {...props}></div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={noop} onkeydown={noop}></div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={noop} onkeyup={noop}></div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={noop} onkeypress={noop}></div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={noop} onkeydown={noop} onkeyup={noop}></div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={noop} onkeyup={noop} onkeypress={noop}></div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={noop} onkeypress={noop} onkeydown={noop}></div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={noop} onkeydown={noop} onkeyup={noop} onkeypress={noop}></div>

<input onclick={noop} type="hidden" />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={noop} aria-hidden="true"></div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={noop} aria-hidden="true"></div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={noop} aria-hidden="false" onkeydown={noop}></div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={noop} aria-hidden={dynamicAriaHiddenValue}></div>

<div onclick={noop} role="presentation"></div>
<div onclick={noop} role="none"></div>
<div onclick={noop} role={dynamicRole}></div>
<div onclick={noop} role={dynamicRole}></div>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:element this={Math.random() ? 'button' : 'div'} onclick={noop} />
