<!-- VALID -->
<div role="presentation" onmouseup={() => {}}></div>
<div role="button" tabindex="-1" onclick={() => {}} onkeypress={() => {}}></div>
<div role="listitem" aria-hidden="true" onclick={() => {}} onkeypress={() => {}}></div>
<button onclick={() => {}}>click me</button>
<dialog onclick={() => {}}>alert</dialog>
<h1 contenteditable="true" onkeydown={() => {}}>Heading</h1>
<h1>Heading</h1>

<!-- INVALID -->
<div role="listitem" onmousedown={() => {}}></div>
<h1 onclick={() => {}} onkeydown={() => {}}>Heading</h1>
<h1 role="banner" onkeyup={() => {}}>Heading</h1>
<p onkeypress={() => {}}></p>
<div role="paragraph" onmouseup={() => {}}></div>
