import { builtinEnvironments, type Environment } from 'vitest/runtime';

const page = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML Basic 1.0//EN" "http://www.w3.org/TR/xhtml-basic/xhtml-basic10.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body></body></html>`;

const environment: Environment = {
	name: 'jsdom-xhtml',
	viteEnvironment: 'client',
	setup(global, options) {
		const jsdom = (options as { jsdom?: Record<string, unknown> }).jsdom ?? {};
		return builtinEnvironments.jsdom.setup(global, {
			...options,
			jsdom: { ...jsdom, html: page, contentType: 'application/xhtml+xml' }
		});
	}
};

export default environment;
