<script>
	const dynamicRole = "button";
</script>

<!-- valid -->
<button onclick={() => {}}>click me</button>
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div onkeydown={() => {}} role="button"></div>
<input type="text" onclick={() => {}} />
<div oncopy={() => {}}></div>
<a href="/foo" onclick={() => {}}>link</a>
<div role={dynamicRole} onclick={() => {}}></div>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<footer onkeydown={() => {}}></footer>

<!-- invalid -->
<div onkeydown={() => {}}></div>
<!-- svelte-ignore a11y_missing_attribute -->
<a onmousedown={() => {}} onmouseup={() => {}} oncopy={() => {}}>link</a>
<div onpointerdown={() => {}}></div>
<div onpointerenter={() => {}}></div>
<div ontouchstart={() => {}}></div>
