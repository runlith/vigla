#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { cli } from '@vigla/kit/cli';
import { identity } from './identity.ts';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
await cli(process.argv.slice(2), version, identity);
