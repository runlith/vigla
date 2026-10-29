<!-- VALID -->
<div aria-hidden="true" role="button" onkeypress={() => {}}></div>
<div aria-disabled="true" role="button" onkeypress={() => {}}></div>
<div disabled role="button" onkeypress={() => {}}></div>
<div role="presentation" onkeypress={() => {}}></div>
<button onclick={() => {}}>click me</button>
<div role="menuitem" tabindex="0" onclick={() => {}} onkeypress={() => {}}></div>
<div role="button" tabindex="-1" onclick={() => {}} onkeypress={() => {}}></div>

<!-- INVALID -->
<div role="button" onkeypress={() => {}}></div>
<span role="menuitem" onkeydown={() => {}}></span>
<div role="button" onkeyup={() => {}}></div>
<span role="menuitem" onclick={() => {}} onkeypress={() => {}}></span>
<div role="button" oncontextmenu={() => {}}></div>
<span role="menuitem" ondblclick={() => {}}></span>
<div role="button" ondrag={() => {}}></div>
<span role="menuitem" ondragend={() => {}}></span>
<div role="button" ondragenter={() => {}}></div>
<span role="menuitem" ondragexit={() => {}}></span>
<div role="button" ondragleave={() => {}}></div>
<span role="menuitem" ondragover={() => {}}></span>
<div role="button" ondragstart={() => {}}></div>
<span role="menuitem" ondrop={() => {}}></span>
<div role="button" onmousedown={() => {}}></div>
<span role="menuitem" onmouseenter={() => {}}></span>
<div role="button" onmouseleave={() => {}}></div>
<span role="menuitem" onmousemove={() => {}}></span>
<div role="button" onmouseout={() => {}}></div>
<span role="menuitem" onmouseover={() => {}}></span>
<div role="button" onmouseup={() => {}}></div>

