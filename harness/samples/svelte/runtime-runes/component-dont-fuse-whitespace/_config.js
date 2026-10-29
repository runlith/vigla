import { test } from '@dromon/harness/helpers';

export default test({
	html: `<p>text before the render tag dont fuse this text with the one from the child</p>`
});
