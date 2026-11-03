#!/usr/bin/env node
// Makes a new block from the SIMAI Framework block author kit's template
// (kits/block/template/): the template's files copied to a folder with its
// name, product.block-name, replaced by the block's type in each of the forms
// the files write it in.
//
//   node kits/block/new.mjs <product>.<name> <folder>
//
// Then: change the schemas, the fields, the words and the HTML, write the
// cases, and run `node kits/block/check.mjs <folder>` until it passes.

import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RESERVED_NAMESPACES } from './check.mjs';

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), 'template');
const TYPE = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u;

/** The template's name in each form, and the block's. */
export function namesOf(type) {
  const [namespace, ...rest] = type.split('.');
  return [
    ['product.block-name', type], // the type, its renderer name
    ['product.block_name', type.replaceAll('-', '_')], // label keys
    ['product/block-name', `${namespace}/${rest.join('.')}`], // field owner, asset id
    ['product-block-name', type.replaceAll('.', '-')], // class names
  ];
}

/** Copies the template to folder as the block type; returns the files written. */
export function newBlock(type, folder) {
  if (!TYPE.test(type)) throw new Error(`block_type_invalid: ${type} is <product>.<name>, lowercase, with - between words`);
  if (RESERVED_NAMESPACES.includes(type.split('.')[0])) throw new Error(`block_namespace_reserved: ${type.split('.')[0]}.* belongs to the SIMAI Framework`);
  const target = resolve(folder);
  if (existsSync(target) && readdirSync(target).length) throw new Error(`block_folder_not_empty: ${target}`);
  cpSync(TEMPLATE, target, { recursive: true });
  const names = namesOf(type);
  const written = [];
  const visit = (path) => {
    if (statSync(path).isDirectory()) return readdirSync(path).forEach((name) => visit(join(path, name)));
    const text = readFileSync(path, 'utf8');
    const next = names.reduce((current, [from, to]) => current.replaceAll(from, to), text);
    writeFileSync(path, next);
    written.push(path);
    return undefined;
  };
  visit(target);
  // The template's own name must be gone from every file.
  for (const path of written) {
    if (names.some(([from, to]) => from !== to && !to.includes(from) && readFileSync(path, 'utf8').includes(from))) throw new Error(`block_template_name_left: ${path}`);
  }
  return written;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [type, folder] = process.argv.slice(2);
  if (!type || !folder) {
    process.stdout.write('node kits/block/new.mjs <product>.<name> <folder>\n');
    process.exitCode = 2;
  } else {
    try {
      const written = newBlock(type, folder);
      process.stdout.write(`${type}: ${written.length} files in ${resolve(folder)}\nnext: node kits/block/check.mjs ${folder}\n`);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}
